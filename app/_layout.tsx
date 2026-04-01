import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { migrateDb } from '@/src/db/database';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="panim.db" onInit={migrateDb}>
      <Stack />
    </SQLiteProvider>
  );
}
