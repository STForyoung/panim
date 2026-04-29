import { type SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

export type PassageVerse = {
  chapter: number;
  verse: number;
  text: string;
};

export type Snippet = {
  id: string;
  book: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number | null;
  verseEnd: number | null;
  passage: PassageVerse[];
  reflection: string;
  prayer: string | null;
  createdAt: number;
  updatedAt: number;
  isFavourite: boolean; // SQLite stores as 0/1 — always use !!snippet.isFavourite in UI
};

type RawSnippet = Omit<Snippet, 'passage' | 'isFavourite'> & {
  passage: string;
  isFavourite: number;
};

export function parseSnippet(raw: RawSnippet): Snippet {
  let passage: PassageVerse[];
  try {
    const parsed = JSON.parse(raw.passage);
    // Already structured array
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      passage = parsed as PassageVerse[];
    } else {
      // Legacy plain string wrapped in JSON
      passage = [{ chapter: raw.chapterStart, verse: raw.verseStart, text: String(parsed) }];
    }
  } catch {
    // Legacy plain text (not JSON at all)
    passage = [{ chapter: raw.chapterStart, verse: raw.verseStart, text: raw.passage }];
  }
  return { ...raw, passage, isFavourite: !!raw.isFavourite };
}

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
    JSON.stringify(snippet.passage),
    snippet.reflection,
    now,
    now
  );
  return id;
}

export async function getSnippet(db: SQLiteDatabase, id: string): Promise<Snippet | null> {
  const raw = await db.getFirstAsync<RawSnippet>('SELECT * FROM snippets WHERE id = ?', id);
  return raw ? parseSnippet(raw) : null;
}

export async function getAllSnippets(db: SQLiteDatabase): Promise<Snippet[]> {
  const rows = await db.getAllAsync<RawSnippet>('SELECT * FROM snippets ORDER BY createdAt DESC');
  return rows.map(parseSnippet);
}

export async function updateSnippet(
  db: SQLiteDatabase,
  id: string,
  fields: Partial<Omit<Snippet, 'id' | 'createdAt'>>
): Promise<void> {
  const updatedAt = Date.now();
  const serialized = fields.passage !== undefined
    ? { ...fields, passage: JSON.stringify(fields.passage) }
    : fields;
  const entries = Object.entries({ ...serialized, updatedAt });
  const setClauses = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => value) as (string | number | null)[];
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
  const rows = await db.getAllAsync<RawSnippet>(
    'SELECT * FROM snippets WHERE isFavourite = 1 ORDER BY updatedAt DESC'
  );
  return rows.map(parseSnippet);
}
