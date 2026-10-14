import { migrateDb } from "@/src/db/database";
import {
  handleNotificationTap,
  scheduleNotifications,
} from "@/src/notifications/scheduler";
import {
  Merriweather_300Light,
  Merriweather_300Light_Italic,
  Merriweather_600SemiBold,
  Merriweather_700Bold,
  useFonts,
} from "@expo-google-fonts/merriweather";
import {
  NotoRashiHebrew_400Regular,
  NotoRashiHebrew_700Bold,
} from "@expo-google-fonts/noto-rashi-hebrew";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { loadTranslationStatus } from "@/src/services/bibleService";
import { Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef } from "react";

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

      // Remember which online translations were found withdrawn in earlier sessions
      loadTranslationStatus();

      scheduleNotifications(db).catch(() => {
        // Scheduling errors are non-fatal — silently ignore
      });
    }
    init();

    // Returning to the app refills the queue of upcoming reminders
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") scheduleNotifications(db).catch(() => {});
    });
    return () => appState.remove();
  }, [db]);

  // Opening a reminder goes to its snippet. This uses the last notification response rather
  // than a listener, because a tap that launches a closed app arrives before this component
  // mounts (fonts and the database load first) and a listener would miss it.
  const lastResponse = Notifications.useLastNotificationResponse();
  const segments = useSegments();
  const handledResponse = useRef<string | null>(null);
  // Set once the app has reached its first real screen, after the start-up redirect
  const settled = useRef(false);

  useEffect(() => {
    if (segments[0] === "(tabs)") settled.current = true;
    if (!lastResponse || !settled.current) return;
    if (
      lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      return;
    }
    const key = `${lastResponse.notification.request.identifier}:${lastResponse.notification.date}`;
    if (handledResponse.current === key) return;
    handledResponse.current = key;
    handleNotificationTap(lastResponse);
    // So the same tap is not acted on again at the next launch
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [lastResponse, segments]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Merriweather_300Light,
    Merriweather_300Light_Italic,
    Merriweather_600SemiBold,
    Merriweather_700Bold,
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
