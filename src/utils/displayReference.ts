import { type Snippet } from '@/src/db/snippets';

/**
 * Derives the display reference string from a snippet's structured fields.
 * Use this everywhere a reference is displayed — never derive inline.
 *
 * Examples:
 *   Single verse:        "John 3:16"
 *   Same-chapter range:  "Psalm 23:1-6"
 *   Cross-chapter range: "Romans 8:1-8:39"
 */
export function getDisplayReference(snippet: Pick<Snippet, 'book' | 'chapterStart' | 'verseStart' | 'chapterEnd' | 'verseEnd'>): string {
  const { book, chapterStart, verseStart, chapterEnd, verseEnd } = snippet;

  if (chapterEnd !== null && verseEnd !== null && chapterEnd !== chapterStart) {
    // Cross-chapter range
    return `${book} ${chapterStart}:${verseStart}-${chapterEnd}:${verseEnd}`;
  }

  if (verseEnd !== null) {
    // Same-chapter range
    return `${book} ${chapterStart}:${verseStart}-${verseEnd}`;
  }

  // Single verse
  return `${book} ${chapterStart}:${verseStart}`;
}
