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
    name: "The Joy of The Lord",
    snippets: [
      {
        book: "Psalms",
        chapterStart: 16,
        verseStart: 11,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "You will show me the path of life; In Your presence is fullness of joy; At Your right hand are pleasures forevermore.",
        reflection:
          "Fullness of joy is found not in circumstances but in God's presence. Am I drawing near to Christ, in whom I find my joy?",
      },
      {
        book: "Psalms",
        chapterStart: 30,
        verseStart: 5,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "For His anger is but for a moment, His favor is for life; Weeping may endure for a night, But joy comes in the morning.",
        reflection:
          "The night of grief has an end; morning is promised. I can trust that what feels permanent is not.",
      },
      {
        book: "Romans",
        chapterStart: 15,
        verseStart: 13,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope by the power of the Holy Spirit.",
        reflection:
          "God is the source of joy and peace; they come through believing, not performing. I receive them as a gift today.",
      },
      {
        book: "John",
        chapterStart: 15,
        verseStart: 11,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "These things I have spoken to you, that My joy may remain in you, and that your joy may be full.",
        reflection:
          "The assurance of God's word is the foundation of my Joy. I choose the Joy that is rooted in the word of God.",
      },
      {
        book: "Philippians",
        chapterStart: 4,
        verseStart: 4,
        chapterEnd: null,
        verseEnd: null,
        passage: "Rejoice in the Lord always. Again I will say, rejoice!",
        reflection:
          "Paul wrote this from prison. Joy is a choice rooted in who God is, not what I feel. I chose to rejoice!",
      },
    ],
  },
  {
    name: "Divine Healing",
    snippets: [
      {
        book: "Isaiah",
        chapterStart: 53,
        verseStart: 5,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "But He was wounded for our transgressions, He was bruised for our iniquities; The chastisement for our peace was upon Him, And by His stripes we are healed.",
        reflection:
          "Healing was purchased at the cross alongside forgiveness. The same sacrifice that reconciled me to God made provision for my body.",
      },
      {
        book: "1 Peter",
        chapterStart: 2,
        verseStart: 24,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "who Himself bore our sins in His own body on the tree, that we, having died to sins, might live for righteousness—by whose stripes you were healed.",
        reflection:
          "Healed — past tense. Peter writes as if it is already done. I am learning to see myself the way God's Word sees me.",
      },
      {
        book: "Psalms",
        chapterStart: 107,
        verseStart: 20,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "He sent His word and healed them, And delivered them from their destructions.",
        reflection:
          "God heals through His word. As I meditate on scripture, I receive more than knowledge — I receive medicine for my soul and body.",
      },
      {
        book: "Matthew",
        chapterStart: 8,
        verseStart: 16,
        chapterEnd: null,
        verseEnd: 17,
        passage:
          'When evening had come, they brought to Him many who were demon-possessed. And He cast out the spirits with a word, and healed all who were sick, that it might be fulfilled which was spoken by Isaiah the prophet, saying: "He Himself took our infirmities And bore our sicknesses."',
        reflection:
          "Jesus healed all who came to Him — not some, not most, but all. His willingness to heal has not changed.",
      },
      {
        book: "Proverbs",
        chapterStart: 4,
        verseStart: 20,
        chapterEnd: null,
        verseEnd: 22,
        passage:
          "My son, give attention to my words; Incline your ear to my sayings. Do not let them depart from your eyes; Keep them in the midst of your heart; For they are life to those who find them, And health to all their flesh.",
        reflection:
          "God's word is medicine — prescribed for daily intake. I keep it before my eyes and in my heart.",
      },
      {
        book: "3 John",
        chapterStart: 1,
        verseStart: 2,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "Beloved, I pray that you may prosper in all things and be in health, just as your soul prospers.",
        reflection:
          "God's desire for me is wholeness — spirit, soul, and body. He is not indifferent to my physical health.",
      },
    ],
  },
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
  {
    name: "Strengthened by God",
    snippets: [
      {
        book: "Isaiah",
        chapterStart: 40,
        verseStart: 31,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "But those who wait on the Lord Shall renew their strength; They shall mount up with wings like eagles, They shall run and not be weary, They shall walk and not faint.",
        reflection:
          "Waiting on God is not passive. It is the posture that unlocks renewed strength. Today as I rest in Him, I am filled with renewed strength.",
      },
      {
        book: "Philippians",
        chapterStart: 4,
        verseStart: 13,
        chapterEnd: null,
        verseEnd: null,
        passage: "I can do all things through Christ who strengthens me.",
        reflection:
          "No challenge is beyond me because the strength is His, not mine. I only need to stay connected to the One who can.",
      },
      {
        book: "Isaiah",
        chapterStart: 41,
        verseStart: 10,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "Fear not, for I am with you; Be not dismayed, for I am your God. I will strengthen you, Yes, I will help you, I will uphold you with My righteous right hand.",
        reflection:
          "Four promises in one verse: I am with you, I am your God, I will strengthen you, I will uphold you. Thank you Lord, for your promises are yes and amen.",
      },
      {
        book: "Deuteronomy",
        chapterStart: 31,
        verseStart: 6,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "Be strong and of good courage, do not fear nor be afraid of them; for the Lord your God, He is the One who goes with you. He will not leave you nor forsake you.",
        reflection:
          "Courage is commanded because God's presence makes it possible. I am not asked to be fearless on my own — only to remember who is with me.",
      },
      {
        book: "Psalms",
        chapterStart: 28,
        verseStart: 7,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "The Lord is my strength and my shield; My heart trusted in Him, and I am helped; Therefore my heart greatly rejoices, And with my song I will praise Him.",
        reflection:
          "Praise is the response to strength received. When I trust and find myself helped, my heart overflows — I worship.",
      },
      {
        book: "2 Corinthians",
        chapterStart: 12,
        verseStart: 9,
        chapterEnd: null,
        verseEnd: null,
        passage:
          'And He said to me, "My grace is sufficient for you, for My strength is made perfect in weakness." Therefore most gladly I will rather boast in my infirmities, that the power of Christ may rest upon me.',
        reflection:
          "My weakness is not an obstacle to God's strength — it is the very place where His power is displayed. My weakness is not my identity, but it is a vehicle for Christ's strength to be manifested.",
      },
      {
        book: "Joshua",
        chapterStart: 1,
        verseStart: 9,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "Have I not commanded you? Be strong and of good courage; do not be afraid, nor be dismayed, for the Lord your God is with you wherever you go.",
        reflection:
          "My strength is in my assurangce that God is with me wherever I go. I am never alone, and that is the source of my courage.",
      },
      {
        book: "Psalms",
        chapterStart: 18,
        verseStart: 32,
        chapterEnd: null,
        verseEnd: null,
        passage:
          "It is God who arms me with strength, And makes my way perfect.",
        reflection:
          "God does not just observe my journey — He arms me for it. The strength I need has already been provided. I choose to walk in the strength He has given me.",
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
    }
  }
}
