import { type SQLiteDatabase } from 'expo-sqlite';

export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY NOT NULL,
      book TEXT NOT NULL,
      chapterStart INTEGER NOT NULL,
      verseStart INTEGER NOT NULL,
      chapterEnd INTEGER,
      verseEnd INTEGER,
      passage TEXT NOT NULL,
      reflection TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      isFavourite INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snippet_topics (
      snippetId TEXT NOT NULL,
      topicId TEXT NOT NULL,
      PRIMARY KEY (snippetId, topicId),
      FOREIGN KEY (snippetId) REFERENCES snippets(id) ON DELETE CASCADE,
      FOREIGN KEY (topicId) REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_schedule (
      id TEXT PRIMARY KEY NOT NULL,
      times TEXT NOT NULL,
      mode TEXT NOT NULL,
      activeTopic TEXT,
      selectionOrder TEXT NOT NULL,
      lastSentIndex INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migrations for existing installs
  try {
    await db.execAsync(
      'ALTER TABLE snippets ADD COLUMN isFavourite INTEGER NOT NULL DEFAULT 0'
    );
  } catch {
    // Column already exists — ignore
  }
}
