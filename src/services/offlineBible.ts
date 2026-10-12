// King James Version (public domain), bundled with the app so the Bible works offline.
// One file per book, loaded only when that book is first opened.
// Each file is a list of chapters; each chapter is a list of verse texts.

export const OFFLINE_TRANSLATION = "KJV";

type BookText = string[][];

const BOOK_LOADERS: Record<number, () => BookText> = {
  1: () => require("@/assets/bible/kjv/1.json"),
  2: () => require("@/assets/bible/kjv/2.json"),
  3: () => require("@/assets/bible/kjv/3.json"),
  4: () => require("@/assets/bible/kjv/4.json"),
  5: () => require("@/assets/bible/kjv/5.json"),
  6: () => require("@/assets/bible/kjv/6.json"),
  7: () => require("@/assets/bible/kjv/7.json"),
  8: () => require("@/assets/bible/kjv/8.json"),
  9: () => require("@/assets/bible/kjv/9.json"),
  10: () => require("@/assets/bible/kjv/10.json"),
  11: () => require("@/assets/bible/kjv/11.json"),
  12: () => require("@/assets/bible/kjv/12.json"),
  13: () => require("@/assets/bible/kjv/13.json"),
  14: () => require("@/assets/bible/kjv/14.json"),
  15: () => require("@/assets/bible/kjv/15.json"),
  16: () => require("@/assets/bible/kjv/16.json"),
  17: () => require("@/assets/bible/kjv/17.json"),
  18: () => require("@/assets/bible/kjv/18.json"),
  19: () => require("@/assets/bible/kjv/19.json"),
  20: () => require("@/assets/bible/kjv/20.json"),
  21: () => require("@/assets/bible/kjv/21.json"),
  22: () => require("@/assets/bible/kjv/22.json"),
  23: () => require("@/assets/bible/kjv/23.json"),
  24: () => require("@/assets/bible/kjv/24.json"),
  25: () => require("@/assets/bible/kjv/25.json"),
  26: () => require("@/assets/bible/kjv/26.json"),
  27: () => require("@/assets/bible/kjv/27.json"),
  28: () => require("@/assets/bible/kjv/28.json"),
  29: () => require("@/assets/bible/kjv/29.json"),
  30: () => require("@/assets/bible/kjv/30.json"),
  31: () => require("@/assets/bible/kjv/31.json"),
  32: () => require("@/assets/bible/kjv/32.json"),
  33: () => require("@/assets/bible/kjv/33.json"),
  34: () => require("@/assets/bible/kjv/34.json"),
  35: () => require("@/assets/bible/kjv/35.json"),
  36: () => require("@/assets/bible/kjv/36.json"),
  37: () => require("@/assets/bible/kjv/37.json"),
  38: () => require("@/assets/bible/kjv/38.json"),
  39: () => require("@/assets/bible/kjv/39.json"),
  40: () => require("@/assets/bible/kjv/40.json"),
  41: () => require("@/assets/bible/kjv/41.json"),
  42: () => require("@/assets/bible/kjv/42.json"),
  43: () => require("@/assets/bible/kjv/43.json"),
  44: () => require("@/assets/bible/kjv/44.json"),
  45: () => require("@/assets/bible/kjv/45.json"),
  46: () => require("@/assets/bible/kjv/46.json"),
  47: () => require("@/assets/bible/kjv/47.json"),
  48: () => require("@/assets/bible/kjv/48.json"),
  49: () => require("@/assets/bible/kjv/49.json"),
  50: () => require("@/assets/bible/kjv/50.json"),
  51: () => require("@/assets/bible/kjv/51.json"),
  52: () => require("@/assets/bible/kjv/52.json"),
  53: () => require("@/assets/bible/kjv/53.json"),
  54: () => require("@/assets/bible/kjv/54.json"),
  55: () => require("@/assets/bible/kjv/55.json"),
  56: () => require("@/assets/bible/kjv/56.json"),
  57: () => require("@/assets/bible/kjv/57.json"),
  58: () => require("@/assets/bible/kjv/58.json"),
  59: () => require("@/assets/bible/kjv/59.json"),
  60: () => require("@/assets/bible/kjv/60.json"),
  61: () => require("@/assets/bible/kjv/61.json"),
  62: () => require("@/assets/bible/kjv/62.json"),
  63: () => require("@/assets/bible/kjv/63.json"),
  64: () => require("@/assets/bible/kjv/64.json"),
  65: () => require("@/assets/bible/kjv/65.json"),
  66: () => require("@/assets/bible/kjv/66.json"),
};

export function getOfflineChapter(
  bookId: number,
  chapter: number,
): { chapter: number; verse: number; text: string }[] {
  const book = BOOK_LOADERS[bookId]?.();
  const verses = book?.[chapter - 1] ?? [];
  return verses.map((text, i) => ({ chapter, verse: i + 1, text }));
}
