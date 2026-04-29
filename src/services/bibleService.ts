// Canonical ordered list of the 66 Bible books (no aliases)
export const CANONICAL_BOOKS: string[] = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
  "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation",
];

export const BOOK_IDS: Record<string, number> = {
  // Old Testament
  Genesis: 1,
  Exodus: 2,
  Leviticus: 3,
  Numbers: 4,
  Deuteronomy: 5,
  Joshua: 6,
  Judges: 7,
  Ruth: 8,
  "1 Samuel": 9,
  "2 Samuel": 10,
  "1 Kings": 11,
  "2 Kings": 12,
  "1 Chronicles": 13,
  "2 Chronicles": 14,
  Ezra: 15,
  Nehemiah: 16,
  Esther: 17,
  Job: 18,
  Psalms: 19,
  Proverbs: 20,
  Ecclesiastes: 21,
  "Song of Solomon": 22,
  "Song of Songs": 22, // alias
  Isaiah: 23,
  Jeremiah: 24,
  Lamentations: 25,
  Ezekiel: 26,
  Daniel: 27,
  Hosea: 28,
  Joel: 29,
  Amos: 30,
  Obadiah: 31,
  Jonah: 32,
  Micah: 33,
  Nahum: 34,
  Habakkuk: 35,
  Zephaniah: 36,
  Haggai: 37,
  Zechariah: 38,
  Malachi: 39,
  // New Testament
  Matthew: 40,
  Mark: 41,
  Luke: 42,
  John: 43,
  Acts: 44,
  Romans: 45,
  "1 Corinthians": 46,
  "2 Corinthians": 47,
  Galatians: 48,
  Ephesians: 49,
  Philippians: 50,
  Colossians: 51,
  "1 Thessalonians": 52,
  "2 Thessalonians": 53,
  "1 Timothy": 54,
  "2 Timothy": 55,
  Titus: 56,
  Philemon: 57,
  Hebrews: 58,
  James: 59,
  "1 Peter": 60,
  "2 Peter": 61,
  "1 John": 62,
  "2 John": 63,
  "3 John": 64,
  Jude: 65,
  Revelation: 66,
};

type VerseRequest = {
  translation: string;
  book: number;
  chapter: number;
  verses: number[];
};

type VerseResponse = {
  pk: number;
  translation: string;
  book: number;
  chapter: number;
  verse: number;
  text: string;
};

function getBookId(book: string): number {
  const id = BOOK_IDS[book];
  if (id === undefined) {
    throw new Error(`Unknown book: "${book}"`);
  }
  return id;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function buildRequests(
  bookId: number,
  chapterStart: number,
  verseStart: number,
  chapterEnd: number | null,
  verseEnd: number | null,
  translation: string,
): VerseRequest[] {
  if (verseEnd === null) {
    // Single verse
    return [
      {
        translation,
        book: bookId,
        chapter: chapterStart,
        verses: [verseStart],
      },
    ];
  }

  if (chapterEnd === null || chapterEnd === chapterStart) {
    // Same-chapter range
    return [
      {
        translation,
        book: bookId,
        chapter: chapterStart,
        verses: range(verseStart, verseEnd),
      },
    ];
  }

  // Cross-chapter range
  const requests: VerseRequest[] = [];
  requests.push({
    translation,
    book: bookId,
    chapter: chapterStart,
    verses: range(verseStart, 200),
  });
  for (let ch = chapterStart + 1; ch < chapterEnd; ch++) {
    requests.push({
      translation,
      book: bookId,
      chapter: ch,
      verses: range(1, 200),
    });
  }
  requests.push({
    translation,
    book: bookId,
    chapter: chapterEnd,
    verses: range(1, verseEnd),
  });
  return requests;
}

function stripHtml(text: string): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").trim();
}

export async function fetchPassage(
  book: string,
  chapterStart: number,
  verseStart: number,
  chapterEnd: number | null,
  verseEnd: number | null,
  translation: string,
): Promise<{ chapter: number; verse: number; text: string }[]> {
  const bookId = getBookId(book);
  const requests = buildRequests(
    bookId,
    chapterStart,
    verseStart,
    chapterEnd,
    verseEnd,
    translation,
  );

  const response = await fetch("https://bolls.life/get-verses/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requests),
  });

  if (!response.ok) {
    throw new Error(
      `Bible API error: ${response.status} ${response.statusText}`,
    );
  }

  const data: VerseResponse[] = (await response.json()).flat();

  if (data.length === 0) {
    throw new Error(
      `No verses returned for "${book} ${chapterStart}:${verseStart}"`,
    );
  }

  data.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);

  return data
    .map((v) => ({ chapter: v.chapter, verse: v.verse, text: stripHtml(v.text) }))
    .filter((v) => v.text.length > 0);
}
