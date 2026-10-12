import * as Crypto from "expo-crypto";
import { type SQLiteDatabase } from "expo-sqlite";

type SeedSnippet = {
  book: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number | null;
  verseEnd: number | null;
  passage: { chapter: number; verse: number; text: string }[];
  reflection: string;
};

type SeedTopic = {
  name: string;
  snippets: SeedSnippet[];
};

// Starter content for a new install. Passages are King James Version text, taken from
// the bundled copy in assets/bible/kjv.
const SEED_DATA: SeedTopic[] = [
  {
    name: "This is the Gospel",
    snippets: [
      {
        book: "John",
        chapterStart: 3,
        verseStart: 16,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 3,
            verse: 16,
            text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
          },
        ],
        reflection:
          "God loved me so much that He died for me. His death is what gave me life. I am saved not only from death, but also for an abundant divine life.",
      },
      {
        book: "Romans",
        chapterStart: 5,
        verseStart: 8,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 5,
            verse: 8,
            text: "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.",
          },
        ],
        reflection:
          "God did not wait for me to become worthy. While I was still far from Him, Christ died for me. His love is not something I earned by works; it is something I received by my faith in Him.",
      },
      {
        book: "Ephesians",
        chapterStart: 2,
        verseStart: 8,
        chapterEnd: null,
        verseEnd: 9,
        passage: [
          {
            chapter: 2,
            verse: 8,
            text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:",
          },
          {
            chapter: 2,
            verse: 9,
            text: "Not of works, lest any man should boast.",
          },
        ],
        reflection:
          "My salvation is a gift, not a reward for works. I did nothing to earn it except to believe in Him, so I have nothing to boast in but Him.",
      },
      {
        book: "2 Corinthians",
        chapterStart: 5,
        verseStart: 21,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 5,
            verse: 21,
            text: "For he hath made him to be sin for us, who knew no sin; that we might be made the righteousness of God in him.",
          },
        ],
        reflection:
          "Jesus took my sin so that I could have His righteousness. What a trade! I can only live to express this righteousness.",
      },
      {
        book: "Romans",
        chapterStart: 6,
        verseStart: 23,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 6,
            verse: 23,
            text: "For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.",
          },
        ],
        reflection:
          "What I should have earned was death, but what I have been given is life. Thank you dear Lord for your grace.",
      },
    ],
  },
  {
    name: "Meditating on The Word",
    snippets: [
      {
        book: "Psalms",
        chapterStart: 1,
        verseStart: 2,
        chapterEnd: null,
        verseEnd: 3,
        passage: [
          {
            chapter: 1,
            verse: 2,
            text: "But his delight is in the law of the LORD; and in his law doth he meditate day and night.",
          },
          {
            chapter: 1,
            verse: 3,
            text: "And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper.",
          },
        ],
        reflection:
          "As I embrace and meditate on God's Word day and night, my life becomes fruitful and steady in every season.",
      },
      {
        book: "Joshua",
        chapterStart: 1,
        verseStart: 8,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 1,
            verse: 8,
            text: "This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night, that thou mayest observe to do according to all that is written therein: for then thou shalt make thy way prosperous, and then thou shalt have good success.",
          },
        ],
        reflection:
          "I will not just meditate on the word, but I will also confess it and as I do what it says, God makes my way prosperous.",
      },
      {
        book: "Psalms",
        chapterStart: 119,
        verseStart: 11,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 119,
            verse: 11,
            text: "Thy word have I hid in mine heart, that I might not sin against thee.",
          },
        ],
        reflection:
          "As I keep God's word in my heart and mind, even my desires will begin to change, that I may live for His glory.",
      },
      {
        book: "Psalms",
        chapterStart: 119,
        verseStart: 105,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 119,
            verse: 105,
            text: "Thy word is a lamp unto my feet, and a light unto my path.",
          },
        ],
        reflection:
          "My steps are ordered and guided by God's Word, even when I cannot see the entire path ahead.",
      },
      {
        book: "Colossians",
        chapterStart: 3,
        verseStart: 16,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 3,
            verse: 16,
            text: "Let the word of Christ dwell in you richly in all wisdom; teaching and admonishing one another in psalms and hymns and spiritual songs, singing with grace in your hearts to the Lord.",
          },
        ],
        reflection:
          "The word will fill every aspect of my Life. It is the very nature of Christ in me, and it will keep flowing through my soul.",
      },
      {
        book: "Matthew",
        chapterStart: 4,
        verseStart: 4,
        chapterEnd: null,
        verseEnd: null,
        passage: [
          {
            chapter: 4,
            verse: 4,
            text: "But he answered and said, It is written, Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.",
          },
        ],
        reflection:
          "I need God's Word even more than I need food. Every word He speaks is life to me.",
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
  // Each snippet gets its own creation time, so "oldest first" follows the order above
  let order = 0;

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
          (id, book, chapterStart, verseStart, chapterEnd, verseEnd, passage, reflection, prayer, translation, createdAt, updatedAt, isFavourite)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'KJV', ?, ?, 0)`,
        snippetId,
        snippet.book,
        snippet.chapterStart,
        snippet.verseStart,
        snippet.chapterEnd ?? null,
        snippet.verseEnd ?? null,
        JSON.stringify(snippet.passage),
        snippet.reflection,
        now + order,
        now + order,
      );
      order += 1;

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
