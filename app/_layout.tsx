import { useEffect, useState } from 'react';
import { Stack, router, useRootNavigationState } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateDb } from '@/src/db/database';

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
      <Stack />
    </SQLiteProvider>
  );
}
