import { TopicChip } from "@/src/components/TopicChip";
import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/constants/theme";
import { createSnippet } from "@/src/db/snippets";
import { addSnippetToTopic } from "@/src/db/snippetTopics";
import { type Topic, createTopic, getAllTopics } from "@/src/db/topics";
import { scheduleNotifications } from "@/src/notifications/scheduler";
import { BOOK_IDS, fetchPassage } from "@/src/services/bibleService";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
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
  const [prayer, setPrayer] = useState("");
  const [bookPickerVisible, setBookPickerVisible] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Topic assignment
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [assignedTopics, setAssignedTopics] = useState<Topic[]>([]);
  const [topicPickerVisible, setTopicPickerVisible] = useState(false);

  // Inline topic creation
  const [newTopicName, setNewTopicName] = useState("");
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicError, setNewTopicError] = useState<string | null>(null);

  useEffect(() => {
    getAllTopics(db).then(setAllTopics);
  }, [db]);

  // Auto-suggest a book topic from the selected book.
  function selectBook(name: string) {
    setBook(name);
    setBookPickerVisible(false);
    setPassage("");
    setError(null);
  }

  function handleReferenceChange(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setPassage("");
      setError(null);
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

  async function handleAddNewTopic() {
    if (!newTopicName.trim()) {
      setNewTopicError("Topic name is required.");
      return;
    }
    setNewTopicError(null);
    setIsAddingTopic(true);
    try {
      await createTopic(db, { name: newTopicName.trim(), type: "custom" });
      const updated = await getAllTopics(db);
      setAllTopics(updated);
      const created = updated.find((t) => t.name === newTopicName.trim() && t.type === "custom");
      if (created) {
        setAssignedTopics((prev) => [...prev, created]);
      }
      setNewTopicName("");
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
        prayer: prayer.trim() || null,
      });
      // Assign to all selected custom topics
      for (const topic of assignedTopics) {
        await addSnippetToTopic(db, snippetId, topic.id);
      }
      // Auto-assign to the book topic matching this snippet's book
      const bookTopic = allTopics.find((t) => t.type === "book" && t.name === book);
      if (bookTopic) {
        await addSnippetToTopic(db, snippetId, bookTopic.id);
      }
      await scheduleNotifications(db);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save snippet.");
      setIsSaving(false);
    }
  }

  // Conceptual topics not yet assigned
  const unassignedTopics = allTopics.filter(
    (t) => t.type === "custom" && !assignedTopics.some((a) => a.id === t.id),
  );

  function inputBorder(field: string) {
    return focusedField === field ? styles.inputFocused : null;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.cancelText}>←</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>New Snippet</Text>

          {/* Book picker */}
          <Text style={styles.sectionLabel}>BOOK</Text>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => setBookPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text
              style={
                book ? styles.bookButtonText : styles.bookButtonPlaceholder
              }
            >
              {book || "Select a book"}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* Book picker modal */}
          <Modal visible={bookPickerVisible} animationType="slide">
            <SafeAreaView style={styles.screen}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCancelArea}
                  onPress={() => setBookPickerVisible(false)}
                >
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Book</Text>
                <View style={styles.modalCancelArea} />
              </View>
              <ScrollView>
                <Text style={styles.bookSectionHeader}>OLD TESTAMENT</Text>
                {OT_BOOKS.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={styles.bookRow}
                    onPress={() => selectBook(name)}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.bookRowText,
                        book === name && styles.bookRowTextSelected,
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.bookSectionHeader}>NEW TESTAMENT</Text>
                {NT_BOOKS.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={styles.bookRow}
                    onPress={() => selectBook(name)}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.bookRowText,
                        book === name && styles.bookRowTextSelected,
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* Start chapter and verse */}
          <View style={styles.inputRow}>
            <View style={styles.inputColumn}>
              <Text style={styles.sectionLabel}>CHAPTER</Text>
              <TextInput
                style={[styles.input, inputBorder("chapterStart")]}
                value={chapterStart}
                onChangeText={handleReferenceChange(setChapterStart)}
                keyboardType="number-pad"
                placeholder="e.g. 3"
                placeholderTextColor={colors.textSecondary + "80"}
                onFocus={() => setFocusedField("chapterStart")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <View style={styles.inputColumn}>
              <Text style={styles.sectionLabel}>VERSE</Text>
              <TextInput
                style={[styles.input, inputBorder("verseStart")]}
                value={verseStart}
                onChangeText={handleReferenceChange(setVerseStart)}
                keyboardType="number-pad"
                placeholder="e.g. 16"
                placeholderTextColor={colors.textSecondary + "80"}
                onFocus={() => setFocusedField("verseStart")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* End chapter and verse */}
          <View style={styles.inputRow}>
            <View style={styles.inputColumn}>
              <Text style={styles.sectionLabelOptional}>END CHAPTER</Text>
              <TextInput
                style={[styles.input, inputBorder("chapterEnd")]}
                value={chapterEnd}
                onChangeText={handleReferenceChange(setChapterEnd)}
                keyboardType="number-pad"
                placeholder="optional"
                placeholderTextColor={colors.textSecondary + "80"}
                onFocus={() => setFocusedField("chapterEnd")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            <View style={styles.inputColumn}>
              <Text style={styles.sectionLabelOptional}>END VERSE</Text>
              <TextInput
                style={[styles.input, inputBorder("verseEnd")]}
                value={verseEnd}
                onChangeText={handleReferenceChange(setVerseEnd)}
                keyboardType="number-pad"
                placeholder="optional"
                placeholderTextColor={colors.textSecondary + "80"}
                onFocus={() => setFocusedField("verseEnd")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Fetch passage */}
          <TouchableOpacity
            style={[styles.primaryButton, isFetching && styles.buttonDisabled]}
            onPress={handleFetchPassage}
            disabled={isFetching}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {isFetching ? "Fetching…" : "Fetch Passage"}
            </Text>
          </TouchableOpacity>

          {/* Passage display */}
          {passage ? (
            <View style={styles.passageCard}>
              <Text style={styles.sectionLabel}>PASSAGE</Text>
              <Text style={styles.passageText}>{passage}</Text>
            </View>
          ) : null}

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {showRetry ? (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleFetchPassage}
                  disabled={isFetching}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Reflection */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            MY REFLECTION
          </Text>
          <TextInput
            style={[styles.reflectionInput, inputBorder("reflection")]}
            value={reflection}
            onChangeText={setReflection}
            placeholder="Your reflection on this passage..."
            placeholderTextColor={colors.textSecondary + "80"}
            multiline
            textAlignVertical="top"
            onFocus={() => setFocusedField("reflection")}
            onBlur={() => setFocusedField(null)}
          />

          {/* Prayer */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            MY PRAYER (optional)
          </Text>
          <TextInput
            style={[styles.reflectionInput, inputBorder("prayer")]}
            value={prayer}
            onChangeText={setPrayer}
            placeholder="Your prayer in response to this passage..."
            placeholderTextColor={colors.textSecondary + "80"}
            multiline
            textAlignVertical="top"
            onFocus={() => setFocusedField("prayer")}
            onBlur={() => setFocusedField(null)}
          />

          {/* Topics */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            TOPICS
          </Text>

          {assignedTopics.length > 0 ? (
            <View style={styles.chipsRow}>
              {assignedTopics.map((topic) => (
                <TopicChip
                  key={topic.id}
                  name={topic.name}
                  onRemove={() => handleRemoveTopic(topic.id)}
                />
              ))}
            </View>
          ) : null}

          {unassignedTopics.length > 0 ? (
            <TouchableOpacity
              style={styles.topicPickerButton}
              onPress={() => setTopicPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.topicPickerText}>Add existing topic…</Text>
            </TouchableOpacity>
          ) : null}

          {/* Topic picker modal */}
          <Modal visible={topicPickerVisible} animationType="slide">
            <SafeAreaView style={styles.screen}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCancelArea}
                  onPress={() => setTopicPickerVisible(false)}
                >
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Topic</Text>
                <View style={styles.modalCancelArea} />
              </View>
              <ScrollView>
                {unassignedTopics.map((topic) => (
                  <TouchableOpacity
                    key={topic.id}
                    style={styles.bookRow}
                    onPress={() => handleAssignTopic(topic)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.bookRowText}>{topic.name}</Text>
                    <Text style={styles.topicTypeTag}>{topic.type}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* Inline create new topic */}
          <Text style={styles.inlineCreateLabel}>NEW TOPIC</Text>
          <TextInput
            style={[
              styles.input,
              inputBorder("newTopic"),
              styles.newTopicInput,
            ]}
            value={newTopicName}
            onChangeText={setNewTopicName}
            placeholder="Topic name"
            placeholderTextColor={colors.textSecondary + "80"}
            onFocus={() => setFocusedField("newTopic")}
            onBlur={() => setFocusedField(null)}
          />
          {newTopicError ? (
            <Text style={styles.errorText}>{newTopicError}</Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.addTopicButton,
              isAddingTopic && styles.buttonDisabled,
            ]}
            onPress={handleAddNewTopic}
            disabled={isAddingTopic}
            activeOpacity={0.7}
          >
            <Text style={styles.addTopicText}>
              {isAddingTopic ? "Adding…" : "Add Topic"}
            </Text>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? "Saving…" : "Save Snippet"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    padding: spacing.lg,
  },

  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Screen title
  screenTitle: {
    ...typography.heading,
    marginBottom: spacing.lg,
  },

  // Section labels
  sectionLabel: {
    ...typography.label,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sectionLabelOptional: {
    ...typography.label,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  sectionLabelSpaced: {
    marginTop: spacing.lg,
  },

  // Book picker button
  bookButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...shadows.card,
  },
  bookButtonText: {
    ...typography.body,
  },
  bookButtonPlaceholder: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chevron: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Book picker modal
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCancelArea: {
    minWidth: 60,
  },
  modalCancel: {
    ...typography.button,
    color: colors.accent,
  },
  modalTitle: {
    ...typography.heading,
    flex: 1,
    textAlign: "center",
    fontSize: 17,
  },
  bookSectionHeader: {
    ...typography.label,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bookRowText: {
    ...typography.body,
  },
  bookRowTextSelected: {
    color: colors.accent,
  },
  topicTypeTag: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Inputs
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  inputColumn: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputFocused: {
    borderColor: colors.accent,
  },

  // Fetch button
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.surface,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Passage card
  passageCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  passageText: {
    ...typography.scriptureItalic,
    color: colors.textSecondary,
  },

  // Error
  errorContainer: {
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  retryText: {
    ...typography.button,
    color: colors.danger,
  },

  // Reflection input
  reflectionInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.scripture,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Topic chips
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },

  // Auto-suggestion
  suggestionRow: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  suggestionText: {
    ...typography.body,
    color: colors.accent,
  },

  // Topic picker trigger
  topicPickerButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  topicPickerText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Inline create topic
  inlineCreateLabel: {
    ...typography.label,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  newTopicInput: {
    marginBottom: spacing.sm,
  },
  typeToggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeButton: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + "26", // 15% opacity
  },
  typeButtonText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  typeButtonTextActive: {
    color: colors.accent,
  },
  addTopicButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  addTopicText: {
    ...typography.button,
    color: colors.accent,
  },

  // Save button
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
});
