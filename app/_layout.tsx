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
  NotoSerifHebrew_400Regular,
  NotoSerifHebrew_700Bold,
} from "@expo-google-fonts/noto-serif-hebrew";
import * as Notifications from "expo-notifications";
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

// Rendered inside SQLiteProvider so it can access the db via useSQLiteContext
function AppInitializer() {
  const db = useSQLiteContext();

  useEffect(() => {
    scheduleNotifications(db).catch(() => {
      // Scheduling errors are non-fatal — silently ignore
    });

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
    NotoSerifHebrew_400Regular,
    NotoSerifHebrew_700Bold,
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
