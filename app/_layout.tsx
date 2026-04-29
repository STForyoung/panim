import { migrateDb } from "@/src/db/database";
import {
  handleNotificationTap,
  scheduleNotifications,
} from "@/src/notifications/scheduler";
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_600SemiBold,
  Lora_700Bold,
  useFonts,
} from "@expo-google-fonts/lora";
import {
  NotoRashiHebrew_400Regular,
  NotoRashiHebrew_700Bold,
} from "@expo-google-fonts/noto-rashi-hebrew";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}

// Rendered inside SQLiteProvider so it can access the db via useSQLiteContext
function AppInitializer() {
  const db = useSQLiteContext();

  useEffect(() => {
    async function init() {
      // Ensure a stable device ID exists for future sync
      const existing = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM metadata WHERE key = ?",
        "deviceId",
      );
      if (!existing) {
        await db.runAsync(
          "INSERT INTO metadata (key, value) VALUES (?, ?)",
          "deviceId",
          Crypto.randomUUID(),
        );
      }

      scheduleNotifications(db).catch(() => {
        // Scheduling errors are non-fatal — silently ignore
      });
    }
    init();

    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationTap,
    );
    return () => subscription.remove();
  }, [db]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_600SemiBold,
    Lora_700Bold,
    NotoRashiHebrew_400Regular,
    NotoRashiHebrew_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SQLiteProvider databaseName="panim.db" onInit={migrateDb}>
      <AppInitializer />
      <Stack screenOptions={{ headerShown: false }} />
    </SQLiteProvider>
  );
}
