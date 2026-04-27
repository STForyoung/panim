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
    name: "The Love of God",
    snippets: [
      {
        book: "John",
        chapterStart: 3,
        verseStart: 16,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "For God so loved the world that He gave His only begotten Son, that whoever believes in Him should not perish but have everlasting life.",
        reflection:
          "God loved me so much that He gave Himself for me. My identity is rooted in His love for me.",
      },
      {
        book: "Romans",
        chapterStart: 8,
        verseStart: 38,
        chapterEnd: null,
        verseEnd: 39,
        passage:
          "For I am persuaded that neither death nor life, nor angels nor principalities nor powers, nor things present nor things to come, nor height nor depth, nor any other created thing, shall be able to separate us from the love of God which is in Christ Jesus our Lord.",
        reflection:
          "Nothing — not my failures, my fears, or my circumstances — can remove me from God's love. I rest in what cannot be taken from me.",
      },
      {
        book: "1 John",
        chapterStart: 4,
        verseStart: 16,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "And we have known and believed the love that God has for us. God is love, and he who abides in love abides in God, and God in him.",
        reflection:
          "Love is not just something God does — it is who He is. To know Him is to be immersed in love itself.",
      },
      {
        book: "Jeremiah",
        chapterStart: 31,
        verseStart: 3,
        chapterEnd: null,
        verseEnd: null,
        passage:
          'The Lord has appeared of old to me, saying: "Yes, I have loved you with an everlasting love; Therefore with lovingkindness I have drawn you."',
        reflection:
          "God's love is everlasting — it did not begin with my faith and it will not end with my failure. It is the foundation beneath everything.",
      },
      {
        book: "Romans",
        chapterStart: 5,
        verseStart: 8,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "But God demonstrates His own love toward us, in that while we were still sinners, Christ died for us.",
        reflection:
          "God did not wait until I was worthy. His love came to me at my worst. I am even more assured of His love knowing that it was not based on my performance.",
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
