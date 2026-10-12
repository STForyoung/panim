import { Ionicons } from "@expo/vector-icons";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type PassageVerse, type Snippet, getSnippet, updateSnippet } from "@/src/db/snippets";
import { Chevron } from "@/src/components/Icons";
import { IconButton } from "@/src/components/IconButton";
import { PassageText } from "@/src/components/PassageText";
import { getSchedule } from "@/src/db/notificationSchedule";
import { scheduleNotifications } from "@/src/notifications/scheduler";
import { getDisplayReference } from "@/src/utils/displayReference";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { EmptyState, LoadingState } from "@/src/components/StateViews";
import { type Topic, createTopic, getAllTopics } from "@/src/db/topics";
import {
  addSnippetToTopic,
  getTopicsForSnippet,
  removeSnippetFromTopic,
} from "@/src/db/snippetTopics";
import { fetchPassage, BOOK_IDS } from "@/src/services/bibleService";
import { TopicChip } from "@/src/components/TopicChip";
import { colors, layout, radius, spacing, typography } from "@/src/constants/theme";

// Derive ordered, deduplicated book list from BOOK_IDS (aliases share an ID — keep first occurrence)
const allBooks = Object.entries(BOOK_IDS)
  .filter(([, id], idx, arr) => arr.findIndex(([, i]) => i === id) === idx)
  .sort(([, a], [, b]) => a - b);
const OT_BOOKS = allBooks.filter(([, id]) => id <= 39).map(([name]) => name);
const NT_BOOKS = allBooks.filter(([, id]) => id >= 40).map(([name]) => name);

export default function EditSnippetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Loading / not found
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Original values — used to detect reference changes
  const [originalSnippet, setOriginalSnippet] = useState<Snippet | null>(null);
  const [originalTopics, setOriginalTopics] = useState<Topic[]>([]);

  // Editable fields
  const [book, setBook] = useState("");
  const [chapterStart, setChapterStart] = useState("");
  const [verseStart, setVerseStart] = useState("");
  const [chapterEnd, setChapterEnd] = useState("");
  const [verseEnd, setVerseEnd] = useState("");
  const [passage, setPassage] = useState<PassageVerse[]>([]);
  const [reflection, setReflection] = useState("");
  const [prayer, setPrayer] = useState("");
  const [bookPickerVisible, setBookPickerVisible] = useState(false);
  const [bookPickerSection, setBookPickerSection] = useState<"OT" | "NT" | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [editingReference, setEditingReference] = useState(false);

  // Topic assignment
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [assignedTopics, setAssignedTopics] = useState<Topic[]>([]);
  const [topicPickerVisible, setTopicPickerVisible] = useState(false);

  // Inline topic creation
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicError, setNewTopicError] = useState<string | null>(null);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [pendingNewTopicNames, setPendingNewTopicNames] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const snippet = await getSnippet(db, id);
      if (!snippet) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const [snippetTopics, topics] = await Promise.all([
        getTopicsForSnippet(db, id),
        getAllTopics(db),
      ]);

      setOriginalSnippet(snippet);
      setOriginalTopics(snippetTopics);

      setBook(snippet.book);
      setChapterStart(String(snippet.chapterStart));
      setVerseStart(String(snippet.verseStart));
      setChapterEnd(snippet.chapterEnd !== null ? String(snippet.chapterEnd) : "");
      setVerseEnd(snippet.verseEnd !== null ? String(snippet.verseEnd) : "");
      setPassage(Array.isArray(snippet.passage) ? snippet.passage : []);
      setReflection(snippet.reflection);
      setPrayer(snippet.prayer ?? "");

      setAssignedTopics(snippetTopics.filter((t) => t.type === "custom"));
      setAllTopics(topics);
      setLoading(false);
    }
    load();
  }, [db, id]);


  function selectBook(name: string) {
    setBook(name);
    setBookPickerVisible(false);
    setBookPickerSection(null);
    setPassage([]);
    setError(null);
  }

  function handleReferenceChange(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setPassage([]);
      setError(null);
    };
  }

  async function handleRefetchPassage() {
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
      const { translation } = await getSchedule(db);
      const verses = await fetchPassage(
        book,
        parseInt(chapterStart, 10),
        parseInt(verseStart, 10),
        chapterEnd ? parseInt(chapterEnd, 10) : null,
        verseEnd ? parseInt(verseEnd, 10) : null,
        translation,
      );
      setPassage(verses);
      setEditingReference(false);
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

  function handleAddNewTopic() {
    const trimmed = newTopicName.trim();
    if (!trimmed) {
      setNewTopicError("Topic name is required.");
      return;
    }
    setNewTopicError(null);
    setPendingNewTopicNames((prev) => [...prev, trimmed]);
    setNewTopicName("");
    setIsCreatingTopic(false);
  }

  async function handleSave() {
    if (chapterEnd && !verseEnd) {
      setError("End verse is required when end chapter is provided.");
      setShowRetry(false);
      return;
    }
    if (passage.length === 0) {
      setError("Re-fetch the passage before saving.");
      setShowRetry(false);
      return;
    }

    setError(null);
    setShowRetry(false);
    setIsSaving(true);
    try {
      await updateSnippet(db, id, {
        book,
        chapterStart: parseInt(chapterStart, 10),
        verseStart: parseInt(verseStart, 10),
        chapterEnd: chapterEnd ? parseInt(chapterEnd, 10) : null,
        verseEnd: verseEnd ? parseInt(verseEnd, 10) : null,
        passage,
        reflection: reflection.trim(),
        prayer: prayer.trim() || null,
      });

      // Create and assign any pending new topics
      for (const name of pendingNewTopicNames) {
        const newTopicId = await createTopic(db, { name, type: "custom" });
        await addSnippetToTopic(db, id, newTopicId);
      }
      // Re-sync custom topics only
      const originalConceptual = originalTopics.filter((t) => t.type === "custom");
      for (const topic of originalConceptual) {
        await removeSnippetFromTopic(db, id, topic.id);
      }
      for (const topic of assignedTopics) {
        await addSnippetToTopic(db, id, topic.id);
      }
      // Ensure book topic is assigned (auto-assign if missing)
      const bookTopic = allTopics.find((t) => t.type === "book" && t.name === book);
      if (bookTopic) {
        await addSnippetToTopic(db, id, bookTopic.id);
      }

      await scheduleNotifications(db).catch(() => {});
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save snippet.");
      setIsSaving(false);
    }
  }

  // Conceptual topics not yet assigned
  const unassignedTopics = allTopics.filter(
    (t) => t.type === "custom" && !assignedTopics.some((a) => a.id === t.id)
  );

  // The reference fields stay hidden while a fetched passage is showing
  const showReferenceFields = editingReference || passage.length === 0;

  function inputBorder(field: string) {
    return focusedField === field ? styles.inputFocused : null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (notFound || !originalSnippet) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.notFound}>
          <ScreenHeader onBack={() => router.back()} />
          <EmptyState icon="help-circle-outline" title="Snippet not found" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.topBar}>
          <IconButton
            icon="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <Text style={styles.topBarTitle}>Edit Snippet</Text>
          <IconButton
            icon="checkmark"
            filled
            onPress={handleSave}
            disabled={isSaving}
            accessibilityLabel="Save changes"
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Passage */}
          {showReferenceFields ? (
            <>
              <View style={styles.formCard}>
                {/* Book picker */}
                <Text style={styles.sectionLabel}>Book</Text>
                <TouchableOpacity
                  style={styles.bookButton}
                  onPress={() => setBookPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={book ? styles.bookButtonText : styles.bookButtonPlaceholder}>
                    {book || "Select a book"}
                  </Text>
                  <Chevron />
                </TouchableOpacity>

                {/* Book picker modal */}
                <Modal visible={bookPickerVisible} animationType="slide">
                  <View style={styles.screen}>
                    <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.md }]}>
                      <TouchableOpacity
                        style={styles.modalCancelArea}
                        onPress={() =>
                          bookPickerSection
                            ? setBookPickerSection(null)
                            : setBookPickerVisible(false)
                        }
                      >
                        <Text style={styles.modalCancel}>
                          {bookPickerSection ? "Back" : "Cancel"}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>
                        {bookPickerSection === "OT"
                          ? "Old Testament"
                          : bookPickerSection === "NT"
                            ? "New Testament"
                            : "Select Book"}
                      </Text>
                      <View style={styles.modalCancelArea} />
                    </View>
                    <ScrollView>
                      {!bookPickerSection ? (
                        <>
                          <TouchableOpacity
                            style={styles.bookRow}
                            onPress={() => setBookPickerSection("OT")}
                            activeOpacity={0.6}
                          >
                            <Text style={styles.bookRowText}>Old Testament</Text>
                            <Chevron />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.bookRow}
                            onPress={() => setBookPickerSection("NT")}
                            activeOpacity={0.6}
                          >
                            <Text style={styles.bookRowText}>New Testament</Text>
                            <Chevron />
                          </TouchableOpacity>
                        </>
                      ) : (
                        (bookPickerSection === "OT" ? OT_BOOKS : NT_BOOKS).map((name) => (
                          <TouchableOpacity
                            key={name}
                            style={styles.bookRow}
                            onPress={() => selectBook(name)}
                            activeOpacity={0.6}
                          >
                            <Text style={[styles.bookRowText, book === name && styles.bookRowTextSelected]}>
                              {name}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </Modal>

                {/* Start chapter and verse */}
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <Text style={styles.sectionLabel}>Chapter</Text>
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
                    <Text style={styles.sectionLabel}>Verse</Text>
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
                    <Text style={styles.sectionLabelOptional}>End chapter</Text>
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
                    <Text style={styles.sectionLabelOptional}>End verse</Text>
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

                {/* Re-fetch passage */}
                <TouchableOpacity
                  style={[styles.primaryButton, isFetching && styles.buttonDisabled]}
                  onPress={handleRefetchPassage}
                  disabled={isFetching}
                  activeOpacity={0.8}
                >
                  <Text style={styles.fetchButtonText}>
                    {isFetching ? "Fetching…" : "Re-fetch Passage"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Passage display */}
              {passage.length > 0 ? (
                <View style={styles.passageCard}>
                  <Text style={styles.sectionLabel}>Passage</Text>
                  <PassageText verses={passage} />
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.passageCard, styles.passageSummary]}>
              <View style={styles.passageSummaryHeader}>
                <Text style={styles.passageReference}>
                  {getDisplayReference({
                    book,
                    chapterStart: parseInt(chapterStart, 10),
                    verseStart: parseInt(verseStart, 10),
                    chapterEnd: chapterEnd ? parseInt(chapterEnd, 10) : null,
                    verseEnd: verseEnd ? parseInt(verseEnd, 10) : null,
                  })}
                </Text>
                <TouchableOpacity
                  onPress={() => setEditingReference(true)}
                  hitSlop={spacing.sm}
                >
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
              </View>
              <PassageText verses={passage} />
            </View>
          )}

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {showRetry ? (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRefetchPassage}
                  disabled={isFetching}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Reflection */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Reflection</Text>
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
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Prayer (optional)</Text>
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
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Topics</Text>

          {(assignedTopics.length > 0 || pendingNewTopicNames.length > 0) ? (
            <View style={styles.chipsRow}>
              {assignedTopics.map((topic) => (
                <TopicChip
                  key={topic.id}
                  name={topic.name}
                  onRemove={() => handleRemoveTopic(topic.id)}
                />
              ))}
              {pendingNewTopicNames.map((name) => (
                <TopicChip
                  key={name}
                  name={name}
                  onRemove={() =>
                    setPendingNewTopicNames((prev) => prev.filter((n) => n !== name))
                  }
                />
              ))}
            </View>
          ) : null}

          <View style={styles.topicActions}>
            {unassignedTopics.length > 0 ? (
              <TouchableOpacity
                style={styles.addTopicButton}
                onPress={() => setTopicPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={layout.iconSm} color={colors.accent} />
                <Text style={styles.addTopicText}>Existing topic</Text>
              </TouchableOpacity>
            ) : null}

            {/* Topic picker modal */}
            <Modal visible={topicPickerVisible} animationType="slide">
              <View style={styles.screen}>
                <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.md }]}>
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
              </View>
            </Modal>

            {/* Inline create new topic */}
            {!isCreatingTopic ? (
              <TouchableOpacity
                style={styles.addTopicButton}
                onPress={() => setIsCreatingTopic(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={layout.iconSm} color={colors.accent} />
                <Text style={styles.addTopicText}>New topic</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={[styles.input, inputBorder("newTopic"), styles.newTopicInput]}
                  value={newTopicName}
                  onChangeText={setNewTopicName}
                  placeholder="Topic name"
                  placeholderTextColor={colors.textSecondary + "80"}
                  onFocus={() => setFocusedField("newTopic")}
                  onBlur={() => setFocusedField(null)}
                  autoFocus
                />
                {newTopicError ? (
                  <Text style={styles.errorText}>{newTopicError}</Text>
                ) : null}
                <View style={styles.inlineTopicActions}>
                  <TouchableOpacity
                    style={styles.addTopicButtonSecondary}
                    onPress={() => {
                      setIsCreatingTopic(false);
                      setNewTopicName("");
                      setNewTopicError(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addTopicTextSecondary}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addTopicButton, { flex: 1, marginBottom: 0 }]}
                    onPress={handleAddNewTopic}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addTopicText}>Add Topic</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={layout.iconSm} color={colors.onAccent} />
            <Text style={styles.primaryButtonText}>
              {isSaving ? "Saving…" : "Save Changes"}
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
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  notFound: {
    flex: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  topBarTitle: {
    ...typography.title,
  },

  // Passage
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  passageSummary: {
    marginTop: 0,
  },
  passageSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  passageReference: {
    ...typography.title,
  },
  changeLink: {
    ...typography.label,
    color: colors.accent,
    fontWeight: "600",
  },

  // Section labels
  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  sectionLabelOptional: {
    ...typography.label,
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  // Headings for the reflection, prayer and topics sections
  sectionLabelSpaced: {
    ...typography.title,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  // Book picker button
  bookButton: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bookButtonText: {
    ...typography.body,
  },
  bookButtonPlaceholder: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Picker modals
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalCancelArea: {
    minWidth: layout.fab + spacing.sm,
  },
  modalCancel: {
    ...typography.button,
    color: colors.accent,
  },
  modalTitle: {
    ...typography.title,
    flex: 1,
    textAlign: "center",
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bookRowText: {
    ...typography.body,
  },
  bookRowTextSelected: {
    color: colors.accent,
    fontWeight: "600",
  },
  topicTypeTag: {
    ...typography.label,
  },

  // Inputs
  inputRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  inputColumn: {
    flex: 1,
  },
  // Fields sit inside a card, so they are tinted instead of outlined
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.md,
    ...typography.body,
    lineHeight: undefined, // lineHeight on single-line TextInput clips descenders on iOS
    borderWidth: 1,
    borderColor: colors.background,
  },
  inputFocused: {
    borderColor: colors.accent,
  },

  // Fetch button
  primaryButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    minHeight: layout.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  fetchButtonText: {
    ...typography.button,
    color: colors.accent,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.onAccent,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Passage card
  passageCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },

  // Error
  errorContainer: {
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
  },
  retryButton: {
    paddingVertical: spacing.sm,
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
    padding: spacing.lg,
    paddingTop: spacing.lg,
    ...typography.reflectionMedium,
    minHeight: layout.textArea,
    borderWidth: 1,
    borderColor: colors.surface,
  },

  // Topic chips
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  // Topic actions
  topicActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  newTopicInput: {
    width: "100%",
    backgroundColor: colors.surface,
    borderColor: colors.surface,
  },
  addTopicButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    minHeight: layout.iconButton,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  addTopicText: {
    ...typography.button,
    color: colors.accent,
  },
  inlineTopicActions: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "stretch",
  },
  addTopicButtonSecondary: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    minHeight: layout.iconButton,
    alignItems: "center",
    justifyContent: "center",
  },
  addTopicTextSecondary: {
    ...typography.button,
    color: colors.textSecondary,
  },

  // Save button
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: layout.controlHeight,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
});
