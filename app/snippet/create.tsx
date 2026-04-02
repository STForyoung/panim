import { useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { createSnippet } from "@/src/db/snippets";
import { fetchPassage, BOOK_IDS } from "@/src/services/bibleService";

// Derive ordered, deduplicated book list from BOOK_IDS (aliases share an ID — keep first occurrence)
const allBooks = Object.entries(BOOK_IDS)
  .filter(([, id], idx, arr) => arr.findIndex(([, i]) => i === id) === idx)
  .sort(([, a], [, b]) => a - b);
const OT_BOOKS = allBooks.filter(([, id]) => id <= 39).map(([name]) => name);
const NT_BOOKS = allBooks.filter(([, id]) => id >= 40).map(([name]) => name);

export default function CreateSnippetScreen() {
  const db = useSQLiteContext();

  const [book, setBook] = useState("");
  const [chapterStart, setChapterStart] = useState("");
  const [verseStart, setVerseStart] = useState("");
  const [chapterEnd, setChapterEnd] = useState("");
  const [verseEnd, setVerseEnd] = useState("");
  const [passage, setPassage] = useState("");
  const [reflection, setReflection] = useState("");
  const [bookPickerVisible, setBookPickerVisible] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  function selectBook(name: string) {
    setBook(name);
    setBookPickerVisible(false);
    setPassage("");
  }

  function handleReferenceChange(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setPassage("");
    };
  }

  async function handleFetchPassage() {
    if (!book || !chapterStart || !verseStart) {
      setError("Select a book and enter chapter and verse.");
      setShowRetry(false);
      return;
    }
    if (chapterEnd && !verseEnd) {
      setError("End verse is required when end chapter is provided.");
      setShowRetry(false);
      return;
    }

    setError(null);
    setShowRetry(false);
    setIsFetching(true);
    try {
      const text = await fetchPassage(
        book,
        parseInt(chapterStart, 10),
        parseInt(verseStart, 10),
        chapterEnd ? parseInt(chapterEnd, 10) : null,
        verseEnd ? parseInt(verseEnd, 10) : null,
        "NKJV", // default translation; will use global setting once Settings screen is built
      );
      setPassage(text);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to fetch passage. Check your connection and try again.",
      );
      setShowRetry(true);
    } finally {
      setIsFetching(false);
    }
  }

  async function handleSave() {
    if (!book || !chapterStart || !verseStart) {
      setError("Select a book and enter chapter and verse.");
      setShowRetry(false);
      return;
    }
    if (!passage) {
      setError("Fetch the passage before saving.");
      setShowRetry(false);
      return;
    }
    if (!reflection.trim()) {
      setError("A reflection is required.");
      setShowRetry(false);
      return;
    }
    if (chapterEnd && !verseEnd) {
      setError("End verse is required when end chapter is provided.");
      setShowRetry(false);
      return;
    }

    setError(null);
    setShowRetry(false);
    setIsSaving(true);
    try {
      await createSnippet(db, {
        book,
        chapterStart: parseInt(chapterStart, 10),
        verseStart: parseInt(verseStart, 10),
        chapterEnd: chapterEnd ? parseInt(chapterEnd, 10) : null,
        verseEnd: verseEnd ? parseInt(verseEnd, 10) : null,
        passage,
        reflection: reflection.trim(),
      });
      router.replace("/");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to save snippet.",
      );
      setIsSaving(false);
    }
  }

  return (
    <ScrollView>
      <View>
        <Text>Book</Text>
        <TouchableOpacity onPress={() => setBookPickerVisible(true)}>
          <Text>{book || "Select a book"}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={bookPickerVisible} animationType="slide">
        <ScrollView>
          <TouchableOpacity onPress={() => setBookPickerVisible(false)}>
            <Text>Cancel</Text>
          </TouchableOpacity>

          <Text>Old Testament</Text>
          {OT_BOOKS.map((name) => (
            <TouchableOpacity key={name} onPress={() => selectBook(name)}>
              <Text>{name}</Text>
            </TouchableOpacity>
          ))}

          <Text>New Testament</Text>
          {NT_BOOKS.map((name) => (
            <TouchableOpacity key={name} onPress={() => selectBook(name)}>
              <Text>{name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Modal>

      <View>
        <View>
          <Text>Chapter</Text>
          <TextInput
            value={chapterStart}
            onChangeText={handleReferenceChange(setChapterStart)}
            keyboardType="number-pad"
            placeholder="1"
          />
        </View>
        <View>
          <Text>Verse</Text>
          <TextInput
            value={verseStart}
            onChangeText={handleReferenceChange(setVerseStart)}
            keyboardType="number-pad"
            placeholder="1"
          />
        </View>
      </View>

      <View>
        <View>
          <Text>End Chapter (optional)</Text>
          <TextInput
            value={chapterEnd}
            onChangeText={handleReferenceChange(setChapterEnd)}
            keyboardType="number-pad"
          />
        </View>
        <View>
          <Text>End Verse (optional)</Text>
          <TextInput
            value={verseEnd}
            onChangeText={handleReferenceChange(setVerseEnd)}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <TouchableOpacity onPress={handleFetchPassage} disabled={isFetching}>
        <Text>{isFetching ? "Fetching…" : "Fetch Passage"}</Text>
      </TouchableOpacity>

      {passage ? (
        <View>
          <Text>{passage}</Text>
        </View>
      ) : null}

      {error ? (
        <View>
          <Text>{error}</Text>
          {showRetry ? (
            <TouchableOpacity onPress={handleFetchPassage} disabled={isFetching}>
              <Text>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View>
        <Text>Reflection</Text>
        <TextInput
          value={reflection}
          onChangeText={setReflection}
          placeholder="Your personal reflection…"
          multiline
        />
      </View>

      <TouchableOpacity onPress={handleSave} disabled={isSaving}>
        <Text>{isSaving ? "Saving…" : "Save Snippet"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
