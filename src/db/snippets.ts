import { type SQLiteDatabase } from 'expo-sqlite';

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
};

export async function createSnippet(
  db: SQLiteDatabase,
  snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO snippets
      (id, book, chapterStart, verseStart, chapterEnd, verseEnd, passage, reflection, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
