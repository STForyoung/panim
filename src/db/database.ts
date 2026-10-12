import { seedDefaultContent } from "@/src/db/seeds";
import { CANONICAL_BOOKS } from "@/src/services/bibleService";
import * as Crypto from "expo-crypto";
import { type SQLiteDatabase } from "expo-sqlite";

export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  // Run PRAGMAs separately — combining them with DDL in one execAsync
  // can cause "database is locked" on Android when switching to WAL mode.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  // v1 — full schema
  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY NOT NULL,
        book TEXT NOT NULL,
        chapterStart INTEGER NOT NULL,
        verseStart INTEGER NOT NULL,
        chapterEnd INTEGER,
        verseEnd INTEGER,
        passage TEXT NOT NULL,
        reflection TEXT NOT NULL,
        prayer TEXT,
        syncedAt INTEGER,
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
        lastSentIndex INTEGER NOT NULL DEFAULT 0,
        translation TEXT NOT NULL DEFAULT 'NKJV',
        notificationContent TEXT NOT NULL DEFAULT 'passage'
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    await db.execAsync('PRAGMA user_version = 1');
  }

  // v2 — record which Bible translation each snippet's passage is in.
  // Everything saved before this was fetched in NKJV.
  if (currentVersion < 2) {
    await db.execAsync(
      "ALTER TABLE snippets ADD COLUMN translation TEXT NOT NULL DEFAULT 'NKJV'",
    );
    await db.execAsync('PRAGMA user_version = 2');
  }

  // Future migrations go here as:
  // if (currentVersion < 3) { ... await db.execAsync('PRAGMA user_version = 3'); }

  // Seed one book topic per canonical Bible book if not already present.
  // Must run before seedDefaultContent so snippets can be assigned to book topics.
  const now = Date.now();
  for (const book of CANONICAL_BOOKS) {
    const existing = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM topics WHERE type = 'book' AND name = ?",
      book,
    );
    if (!existing) {
      await db.runAsync(
        "INSERT INTO topics (id, name, type, createdAt) VALUES (?, ?, ?, ?)",
        Crypto.randomUUID(),
        book,
        "book",
        now,
      );
    }
  }

  await seedDefaultContent(db);
}
