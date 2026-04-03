import { createSnippet } from "@/src/db/snippets";
import { addSnippetToTopic } from "@/src/db/snippetTopics";
import { type Topic, createTopic, getAllTopics } from "@/src/db/topics";
import { BOOK_IDS, fetchPassage } from "@/src/services/bibleService";
import { scheduleNotifications } from "@/src/notifications/scheduler";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Derive ordered, deduplicated book list from BOOK_IDS (aliases share an ID — keep first occurrence)
const allBooks = Object.entries(BOOK_IDS)
  .filter(([, id], idx, arr) => arr.findIndex(([, i]) => i === id) === idx)
  .sort(([, a], [, b]) => a - b);
const OT_BOOKS = allBooks.filter(([, id]) => id <= 39).map(([name]) => name);
const NT_BOOKS = allBooks.filter(([, id]) => id >= 40).map(([name]) => name);

export default function CreateSnippetScreen() {
  const db = useSQLiteContext();

  // Passage fields
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

  // Topic assignment
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [assignedTopics, setAssignedTopics] = useState<Topic[]>([]);
  const [topicPickerVisible, setTopicPickerVisible] = useState(false);

  // Inline topic creation
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicType, setNewTopicType] = useState<"conceptual" | "directed">(
    "conceptual",
  );
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicError, setNewTopicError] = useState<string | null>(null);

  useEffect(() => {
    getAllTopics(db).then(setAllTopics);
  }, [db]);

  // Auto-suggest a directed topic from book + chapterStart.
  // Only suggest if that directed topic name doesn't already exist in the DB.
  const suggestedTopicName =
    book && chapterStart ? `${book} ${chapterStart}` : null;
  const showSuggestion =
    suggestedTopicName !== null &&
    !allTopics.some(
      (t) => t.type === "directed" && t.name === suggestedTopicName,
    ) &&
    !assignedTopics.some((t) => t.name === suggestedTopicName);

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

  function handleAssignTopic(topic: Topic) {
    if (!assignedTopics.some((t) => t.id === topic.id)) {
      setAssignedTopics((prev) => [...prev, topic]);
    }
    setTopicPickerVisible(false);
  }

  function handleRemoveTopic(topicId: string) {
    setAssignedTopics((prev) => prev.filter((t) => t.id !== topicId));
  }

  async function handleAcceptSuggestion() {
    if (!suggestedTopicName) return;
    await createTopic(db, { name: suggestedTopicName, type: "directed" });
    const updated = await getAllTopics(db);
    setAllTopics(updated);
    const created = updated.find((t) => t.name === suggestedTopicName);
    if (created) {
      setAssignedTopics((prev) => [...prev, created]);
    }
  }

  async function handleAddNewTopic() {
    if (!newTopicName.trim()) {
      setNewTopicError("Topic name is required.");
      return;
    }
    setNewTopicError(null);
    setIsAddingTopic(true);
    try {
      await createTopic(db, { name: newTopicName.trim(), type: newTopicType });
      const updated = await getAllTopics(db);
      setAllTopics(updated);
      const created = updated.find((t) => t.name === newTopicName.trim());
      if (created) {
        setAssignedTopics((prev) => [...prev, created]);
      }
      setNewTopicName("");
      setNewTopicType("conceptual");
    } catch (e) {
      setNewTopicError(
        e instanceof Error ? e.message : "Failed to create topic.",
      );
    } finally {
      setIsAddingTopic(false);
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
      const snippetId = await createSnippet(db, {
        book,
        chapterStart: parseInt(chapterStart, 10),
        verseStart: parseInt(verseStart, 10),
        chapterEnd: chapterEnd ? parseInt(chapterEnd, 10) : null,
        verseEnd: verseEnd ? parseInt(verseEnd, 10) : null,
        passage,
        reflection: reflection.trim(),
      });
      for (const topic of assignedTopics) {
        await addSnippetToTopic(db, snippetId, topic.id);
      }
      await scheduleNotifications(db);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save snippet.");
      setIsSaving(false);
    }
  }

  // Topics available to add (not yet assigned)
  const unassignedTopics = allTopics.filter(
    (t) => !assignedTopics.some((a) => a.id === t.id),
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16 }}
    >
      <View>
        <Text>Book</Text>
        <TouchableOpacity onPress={() => setBookPickerVisible(true)}>
          <Text>{book || "Select a book"}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={bookPickerVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
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
        </SafeAreaView>
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
            <TouchableOpacity
              onPress={handleFetchPassage}
              disabled={isFetching}
            >
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

      {/* Topic Assignment */}
      <View>
        <Text>Topics</Text>

        {/* Assigned topics */}
        {assignedTopics.map((topic) => (
          <View key={topic.id}>
            <Text>
              {topic.name} ({topic.type})
            </Text>
            <TouchableOpacity onPress={() => handleRemoveTopic(topic.id)}>
              <Text>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Auto-suggestion */}
        {showSuggestion ? (
          <TouchableOpacity onPress={handleAcceptSuggestion}>
            <Text>+ Suggest: {suggestedTopicName}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Picker for existing topics */}
        {unassignedTopics.length > 0 ? (
          <TouchableOpacity onPress={() => setTopicPickerVisible(true)}>
            <Text>Add existing topic…</Text>
          </TouchableOpacity>
        ) : null}

        <Modal visible={topicPickerVisible} animationType="slide">
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TouchableOpacity onPress={() => setTopicPickerVisible(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <Text>Select a topic</Text>
              {unassignedTopics.map((topic) => (
                <TouchableOpacity
                  key={topic.id}
                  onPress={() => handleAssignTopic(topic)}
                >
                  <Text>
                    {topic.name} ({topic.type})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Inline create new topic */}
        <Text>New topic</Text>
        <TextInput
          value={newTopicName}
          onChangeText={setNewTopicName}
          placeholder="Topic name"
        />
        <View>
          <TouchableOpacity onPress={() => setNewTopicType("conceptual")}>
            <Text>
              {newTopicType === "conceptual" ? "[x]" : "[ ]"} Conceptual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setNewTopicType("directed")}>
            <Text>{newTopicType === "directed" ? "[x]" : "[ ]"} Directed</Text>
          </TouchableOpacity>
        </View>
        {newTopicError ? <Text>{newTopicError}</Text> : null}
        <TouchableOpacity onPress={handleAddNewTopic} disabled={isAddingTopic}>
          <Text>{isAddingTopic ? "Adding…" : "Add Topic"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleSave} disabled={isSaving}>
        <Text>{isSaving ? "Saving…" : "Save Snippet"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
