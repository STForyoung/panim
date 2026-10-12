import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  FALLBACK_TRANSLATION,
  getOfflineChapter,
  isOfflineTranslation,
} from "@/src/services/offlineBible";

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

// Number of chapters in each book, in the same order as CANONICAL_BOOKS
const CHAPTER_COUNTS: number[] = [
  50, 40, 27, 36, 34,
  24, 21, 4, 31, 24,
  22, 25, 29, 36, 10,
  13, 10, 42, 150, 31,
  12, 8, 66, 52, 5,
  48, 12, 14, 3, 9,
  1, 4, 7, 3, 3,
  3, 2, 14, 4,
  28, 16, 24, 21, 28,
  16, 16, 13, 6, 6,
  4, 4, 5, 3, 6,
  4, 3, 1, 13, 5,
  5, 3, 5, 1, 1,
  1, 22,
];

export function getChapterCount(book: string): number {
  return CHAPTER_COUNTS[getBookId(book) - 1];
}

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

// How long to wait for the provider before treating the device as offline
const FETCH_TIMEOUT_MS = 10000;

// Translations the provider no longer serves. NIV is known; others are added when a check
// finds them gone, and remembered on the device so Settings can show it straight away.
const REMOVED_KEY = "removedTranslations";
const removedTranslations = new Set<string>(["NIV"]);

// Online translations already confirmed to be working since the app started
const confirmedTranslations = new Set<string>();

const UNREACHABLE_MESSAGE =
  "Couldn't reach the Bible service. Check your connection and try again.";

// Two short verses with different text, used to check that a translation is really served
const PROBE = { book: 43, chapter: 11, verses: [35, 36] };

// Thrown when the provider has stopped serving a translation (as opposed to being offline)
export class TranslationRemovedError extends Error {
  constructor(translation: string) {
    super(
      `${TRANSLATION_NAMES[translation] ?? translation} is no longer available. Choose another version in Settings.`,
    );
    this.name = "TranslationRemovedError";
  }
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function saveRemovedTranslations() {
  AsyncStorage.setItem(REMOVED_KEY, JSON.stringify([...removedTranslations])).catch(
    () => {
      // Remembering this is a convenience — the check runs again next session
    },
  );
}

// Loads the translations found to be gone in earlier sessions. Call once at app start.
export async function loadTranslationStatus(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(REMOVED_KEY);
    for (const code of stored ? (JSON.parse(stored) as string[]) : []) {
      removedTranslations.add(code);
    }
  } catch {
    // Nothing stored, or unreadable — start from the known list
  }
}

// Asks the provider for two known verses. A translation that has been withdrawn comes back
// either empty or with the same notice in place of every verse.
// Returns null when the provider cannot be reached, so being offline is never mistaken for removal.
async function probeTranslation(translation: string): Promise<boolean | null> {
  try {
    const response = await fetchWithTimeout("https://bolls.life/get-verses/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ translation, ...PROBE }]),
    });
    if (!response.ok) return null;
    const verses: VerseResponse[] = (await response.json()).flat();
    const texts = verses.map((v) => stripHtml(v.text));
    return texts.length === 2 && texts[0].length > 0 && texts[0] !== texts[1];
  } catch {
    return null;
  }
}

// Checks an online translation the first time it is used each session.
// "removed" is remembered; a translation that comes back is cleared again.
async function checkTranslation(
  translation: string,
): Promise<"ok" | "removed" | "unreachable"> {
  if (confirmedTranslations.has(translation)) return "ok";
  const served = await probeTranslation(translation);
  if (served === null) {
    // Can't check right now — trust what was found last time
    return removedTranslations.has(translation) ? "removed" : "unreachable";
  }
  if (served) {
    confirmedTranslations.add(translation);
    if (removedTranslations.delete(translation)) saveRemovedTranslations();
    return "ok";
  }
  if (!removedTranslations.has(translation)) {
    removedTranslations.add(translation);
    saveRemovedTranslations();
  }
  return "removed";
}

// Re-checks the online translations in a list, so Settings can label them correctly.
// One at a time: the provider rejects bursts of requests.
export async function refreshTranslationStatus(translations: string[]): Promise<void> {
  for (const translation of translations) {
    if (!isOfflineTranslation(translation)) await checkTranslation(translation);
  }
}

// Includes translations no longer offered, so older snippets still show their full name
export const TRANSLATION_NAMES: Record<string, string> = {
  KJV: "King James Version",
  BSB: "Berean Standard Bible",
  NKJV: "New King James Version",
  ESV: "English Standard Version",
  NASB: "New American Standard Bible",
  NLT: "New Living Translation",
};

// Who owns each translation's text, shown on the "Scripture versions" sheet in Settings.
// These state ownership only. Do not add "Used by permission" unless a licence is in place.
export const TRANSLATION_CREDITS: Record<string, string> = {
  KJV: "King James Version. Public domain.",
  BSB: "Berean Standard Bible. Public domain. berean.bible",
  NKJV: "New King James Version®. Copyright © 1982 by Thomas Nelson. All rights reserved.",
  ESV: "The Holy Bible, English Standard Version®. Copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. All rights reserved.",
  NASB: "New American Standard Bible®. Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. All rights reserved. lockman.org",
  NLT: "Holy Bible, New Living Translation. Copyright © 1996, 2004, 2015 by Tyndale House Foundation. All rights reserved.",
};

export type TranslationAvailability = "offline" | "online" | "unavailable";

// Whether a translation is bundled with the app, fetched on demand, or not offered by the provider
export function getTranslationAvailability(
  translation: string,
): TranslationAvailability {
  if (isOfflineTranslation(translation)) return "offline";
  if (removedTranslations.has(translation)) return "unavailable";
  return "online";
}

function stripHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<S>[^<]*<\/S>/gi, "") // Strong's numbers (KJV)
    .replace(/<sup>[^<]*<\/sup>/gi, "") // translator footnotes (KJV)
    .replace(/<br\s*\/?>/gi, " ") // line breaks in poetry (NLT)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

  if (isOfflineTranslation(translation)) {
    const lastChapter = chapterEnd ?? chapterStart;
    const verses: { chapter: number; verse: number; text: string }[] = [];
    for (let chapter = chapterStart; chapter <= lastChapter; chapter++) {
      const from = chapter === chapterStart ? verseStart : 1;
      const to =
        verseEnd === null
          ? verseStart
          : chapter === lastChapter
            ? verseEnd
            : Infinity;
      verses.push(
        ...getOfflineChapter(translation, bookId, chapter).filter(
          (v) => v.verse >= from && v.verse <= to,
        ),
      );
    }
    if (verses.length === 0) {
      throw new Error(
        `No verses returned for "${book} ${chapterStart}:${verseStart}"`,
      );
    }
    return verses;
  }

  // Text is only accepted from a translation confirmed to be served, so a publisher
  // notice can never be saved as a passage
  const status = await checkTranslation(translation);
  if (status === "removed") throw new TranslationRemovedError(translation);
  if (status === "unreachable") throw new Error(UNREACHABLE_MESSAGE);

  const requests = buildRequests(
    bookId,
    chapterStart,
    verseStart,
    chapterEnd,
    verseEnd,
    translation,
  );

  let response: Response;
  try {
    response = await fetchWithTimeout("https://bolls.life/get-verses/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requests),
    });
  } catch {
    throw new Error(UNREACHABLE_MESSAGE);
  }

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

export type ChapterResult = {
  verses: { chapter: number; verse: number; text: string }[];
  // The translation actually shown, which differs from the one asked for when offline
  translation: string;
  // Why the bundled translation is standing in, if it is:
  // "offline" — the provider could not be reached; "removed" — it no longer serves the translation
  fallback: "offline" | "removed" | null;
};

// Chapters already fetched this session, keyed by translation, book and chapter
const chapterCache = new Map<string, ChapterResult["verses"]>();

// Fetches a whole chapter for reading. Online chapters are kept in memory only.
// If the translation cannot be fetched, the bundled fallback is returned with the reason.
export async function fetchChapter(
  book: string,
  chapter: number,
  translation: string,
): Promise<ChapterResult> {
  const bookId = getBookId(book);

  if (isOfflineTranslation(translation)) {
    return {
      verses: getOfflineChapter(translation, bookId, chapter),
      translation,
      fallback: null,
    };
  }

  const fallbackResult = (reason: "offline" | "removed"): ChapterResult => ({
    verses: getOfflineChapter(FALLBACK_TRANSLATION, bookId, chapter),
    translation: FALLBACK_TRANSLATION,
    fallback: reason,
  });

  const cacheKey = `${translation}:${bookId}:${chapter}`;
  const cached = chapterCache.get(cacheKey);
  if (cached) return { verses: cached, translation, fallback: null };

  const status = await checkTranslation(translation);
  if (status === "removed") return fallbackResult("removed");
  if (status === "unreachable") return fallbackResult("offline");

  try {
    const response = await fetchWithTimeout(
      `https://bolls.life/get-text/${translation}/${bookId}/${chapter}/`,
    );
    if (!response.ok) return fallbackResult("offline");

    const data: { verse: number; text: string }[] = await response.json();
    const verses = data
      .map((v) => ({ chapter, verse: v.verse, text: stripHtml(v.text) }))
      .filter((v) => v.text.length > 0)
      .sort((a, b) => a.verse - b.verse);
    if (verses.length === 0) return fallbackResult("offline");

    chapterCache.set(cacheKey, verses);
    return { verses, translation, fallback: null };
  } catch {
    return fallbackResult("offline");
  }
}
