import { type PassageVerse } from "@/src/db/snippets";

// A passage chosen in the Bible reader, handed to the Create Snippet screen
export type PassageDraft = {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  verses: PassageVerse[];
};

let draft: PassageDraft | null = null;

export function setPassageDraft(next: PassageDraft) {
  draft = next;
}

export function getPassageDraft(): PassageDraft | null {
  return draft;
}
