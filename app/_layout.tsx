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
} from "@expo-google-fonts/lora";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack, router, useRootNavigationState } from "expo-router";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

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
  const navigationState = useRootNavigationState();
  const [hasLaunched, setHasLaunched] = useState<boolean | null>(null);

  // Fonts must be loaded before rendering to prevent flash of unstyled text.
  // TODO post-MVP: replace return null with expo-splash-screen to avoid blank screen during load.
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_600SemiBold,
    Lora_700Bold,
  });

  useEffect(() => {
    AsyncStorage.getItem("hasLaunched").then((value) => {
      setHasLaunched(value !== null);
    });
  }, []);

  useEffect(() => {
    if (!navigationState?.key || hasLaunched === null) return;
    if (!hasLaunched) {
      router.replace("/onboarding");
    }
  }, [navigationState?.key, hasLaunched]);

  if (!fontsLoaded) return null;

  return (
    <SQLiteProvider databaseName="panim.db" onInit={migrateDb}>
      <AppInitializer />
      <Stack screenOptions={{ headerShown: false }} />
    </SQLiteProvider>
  );
}
