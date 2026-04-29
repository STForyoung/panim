import { type SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

export type Topic = {
  id: string;
  name: string;
  type: 'custom' | 'book';
  createdAt: number;
};

export async function createTopic(
  db: SQLiteDatabase,
  topic: Omit<Topic, 'id' | 'createdAt'>
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO topics (id, name, type, createdAt) VALUES (?, ?, ?, ?)',
    id,
    topic.name,
    topic.type,
    now
  );
  return id;
}

export async function getTopic(db: SQLiteDatabase, id: string): Promise<Topic | null> {
  return db.getFirstAsync<Topic>('SELECT * FROM topics WHERE id = ?', id);
}

export async function getAllTopics(db: SQLiteDatabase): Promise<Topic[]> {
  return db.getAllAsync<Topic>('SELECT * FROM topics ORDER BY createdAt DESC');
}

export async function deleteTopic(db: SQLiteDatabase, id: string): Promise<void> {
  const topic = await db.getFirstAsync<{ type: string }>('SELECT type FROM topics WHERE id = ?', id);
  if (topic?.type === 'book') {
    throw new Error('Book topics cannot be deleted.');
  }
  await db.runAsync('DELETE FROM topics WHERE id = ?', id);
}
