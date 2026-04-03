import { useEffect, useState } from 'react';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { migrateDb } from '@/src/db/database';
import { scheduleNotifications, handleNotificationTap } from '@/src/notifications/scheduler';

// Rendered inside SQLiteProvider so it can access the db via useSQLiteContext
function AppInitializer() {
  const db = useSQLiteContext();

  useEffect(() => {
    scheduleNotifications(db).catch(() => {
      // Scheduling errors are non-fatal — silently ignore
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationTap
    );
    return () => subscription.remove();
  }, [db]);

  return null;
}

export default function RootLayout() {
  const navigationState = useRootNavigationState();
  const [hasLaunched, setHasLaunched] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('hasLaunched').then((value) => {
      setHasLaunched(value !== null);
    });
  }, []);

  useEffect(() => {
    if (!navigationState?.key || hasLaunched === null) return;
    if (!hasLaunched) {
      router.replace('/onboarding');
    }
  }, [navigationState?.key, hasLaunched]);

  return (
    <SQLiteProvider databaseName="panim.db" onInit={migrateDb}>
      <AppInitializer />
      <Stack />
    </SQLiteProvider>
  );
}
