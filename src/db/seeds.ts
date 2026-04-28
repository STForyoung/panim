import * as Crypto from "expo-crypto";
import { type SQLiteDatabase } from "expo-sqlite";

type SeedSnippet = {
  book: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number | null;
  verseEnd: number | null;
  passage: string;
  reflection: string;
};

type SeedTopic = {
  name: string;
  snippets: SeedSnippet[];
};

const SEED_DATA: SeedTopic[] = [
  {
    name: "Beholding the face of God",
    snippets: [
      {
        book: "Psalm",
        chapterStart: 27,
        verseStart: 8,
        chapterEnd: null,
        verseEnd: null,
        passage:
          'When You said, "Seek My face," My heart said to You, "Your face, Lord, I will seek."',
        reflection:
          "God, according to His desire, has invited me to know His presence. As I diligently seek Him, I receive His promise of intimacy and a revelation of His glory.",
      },
    ],
  },
];

export async function seedDefaultContent(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM snippets",
  );
  if (row && row.count > 0) return;

  const now = Date.now();

  for (const topic of SEED_DATA) {
    const topicId = Crypto.randomUUID();
    await db.runAsync(
      "INSERT INTO topics (id, name, type, createdAt) VALUES (?, ?, ?, ?)",
      topicId,
      topic.name,
      "custom",
      now,
    );

    for (const snippet of topic.snippets) {
      const snippetId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO snippets
          (id, book, chapterStart, verseStart, chapterEnd, verseEnd, passage, reflection, prayer, createdAt, updatedAt, isFavourite)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0)`,
        snippetId,
        snippet.book,
        snippet.chapterStart,
        snippet.verseStart,
        snippet.chapterEnd ?? null,
        snippet.verseEnd ?? null,
        snippet.passage,
        snippet.reflection,
        now,
        now,
      );

      await db.runAsync(
        "INSERT INTO snippet_topics (snippetId, topicId) VALUES (?, ?)",
        snippetId,
        topicId,
      );

      // Also assign to the book topic
      const bookTopic = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM topics WHERE type = 'book' AND name = ?",
        snippet.book,
      );
      if (bookTopic) {
        await db.runAsync(
          "INSERT INTO snippet_topics (snippetId, topicId) VALUES (?, ?)",
          snippetId,
          bookTopic.id,
        );
      }
    }
  }
}
