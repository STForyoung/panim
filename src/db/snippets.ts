import { type SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

export type Snippet = {
  id: string;
  book: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number | null;
  verseEnd: number | null;
  passage: string;
  reflection: string;
  createdAt: number;
  updatedAt: number;
  isFavourite: boolean; // SQLite stores as 0/1 — always use !!snippet.isFavourite in UI
};

export async function createSnippet(
  db: SQLiteDatabase,
  snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt' | 'isFavourite'>
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO snippets
      (id, book, chapterStart, verseStart, chapterEnd, verseEnd, passage, reflection, createdAt, updatedAt, isFavourite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    id,
    snippet.book,
    snippet.chapterStart,
    snippet.verseStart,
    snippet.chapterEnd ?? null,
    snippet.verseEnd ?? null,
    snippet.passage,
    snippet.reflection,
    now,
    now
  );
  return id;
}

export async function getSnippet(db: SQLiteDatabase, id: string): Promise<Snippet | null> {
  return db.getFirstAsync<Snippet>('SELECT * FROM snippets WHERE id = ?', id);
}

export async function getAllSnippets(db: SQLiteDatabase): Promise<Snippet[]> {
  return db.getAllAsync<Snippet>('SELECT * FROM snippets ORDER BY createdAt DESC');
}

export async function updateSnippet(
  db: SQLiteDatabase,
  id: string,
  fields: Partial<Omit<Snippet, 'id' | 'createdAt'>>
): Promise<void> {
  const updatedAt = Date.now();
  const entries = Object.entries({ ...fields, updatedAt });
  const setClauses = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  await db.runAsync(`UPDATE snippets SET ${setClauses} WHERE id = ?`, ...values, id);
}

export async function deleteSnippet(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM snippets WHERE id = ?', id);
}

export async function toggleFavourite(
  db: SQLiteDatabase,
  id: string,
  isFavourite: boolean
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    'UPDATE snippets SET isFavourite = ?, updatedAt = ? WHERE id = ?',
    isFavourite ? 1 : 0,
    now,
    id
  );
}

export async function getFavouriteSnippets(db: SQLiteDatabase): Promise<Snippet[]> {
  return db.getAllAsync<Snippet>(
    'SELECT * FROM snippets WHERE isFavourite = 1 ORDER BY updatedAt DESC'
  );
}
