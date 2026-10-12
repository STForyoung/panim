import { Button } from "@/src/components/Button";
import { IconButton } from "@/src/components/IconButton";
import { EmptyState, LoadingState } from "@/src/components/StateViews";
import {
  colors,
  fonts,
  layout,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/constants/theme";
import { getSchedule } from "@/src/db/notificationSchedule";
import { type PassageVerse } from "@/src/db/snippets";
import {
  BOOK_IDS,
  CANONICAL_BOOKS,
  fetchChapter,
  getChapterCount,
} from "@/src/services/bibleService";
import { setPassageDraft } from "@/src/services/passageDraft";
import { getDisplayReference } from "@/src/utils/displayReference";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const LAST_READ_KEY = "lastRead";
const DEFAULT_POSITION = { book: "John", chapter: 1 };

const OT_BOOKS = CANONICAL_BOOKS.filter((name) => BOOK_IDS[name] <= 39);
const NT_BOOKS = CANONICAL_BOOKS.filter((name) => BOOK_IDS[name] >= 40);

type Position = { book: string; chapter: number };

function getAdjacentChapter(
  { book, chapter }: Position,
  direction: 1 | -1,
): Position | null {
  const next = chapter + direction;
  if (next >= 1 && next <= getChapterCount(book)) {
    return { book, chapter: next };
  }
  const adjacentBook = CANONICAL_BOOKS[CANONICAL_BOOKS.indexOf(book) + direction];
  if (!adjacentBook) return null;
  return {
    book: adjacentBook,
    chapter: direction === 1 ? 1 : getChapterCount(adjacentBook),
  };
}

export default function BibleScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [position, setPosition] = useState<Position | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [verses, setVerses] = useState<PassageVerse[]>([]);
  // What is actually on screen, which is the bundled translation when offline
  const [shownTranslation, setShownTranslation] = useState<string | null>(null);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const offlineFallbackRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // Selected verse range within the current chapter
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

  // Book and chapter picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerBook, setPickerBook] = useState<string | null>(null);
  const [pickerTestament, setPickerTestament] = useState<"OT" | "NT">("NT");

  // Restore the last chapter that was open
  useEffect(() => {
    AsyncStorage.getItem(LAST_READ_KEY)
      .then((value) => {
        const saved: Position | null = value ? JSON.parse(value) : null;
        setPosition(
          saved && BOOK_IDS[saved.book] ? saved : DEFAULT_POSITION,
        );
      })
      .catch(() => setPosition(DEFAULT_POSITION));
  }, []);

  // Pick up a translation change made in Settings
  useFocusEffect(
    useCallback(() => {
      getSchedule(db).then((schedule) => setTranslation(schedule.translation));
      // Coming back to the tab while on the offline fallback retries the chosen translation
      if (offlineFallbackRef.current) setReloadCount((count) => count + 1);
    }, [db]),
  );

  useEffect(() => {
    if (!position || !translation) return;
    let cancelled = false;

    fetchChapter(position.book, position.chapter, translation)
      .then((result) => {
        if (cancelled) return;
        setVerses(result.verses);
        setShownTranslation(result.translation);
        setOfflineFallback(result.offlineFallback);
        offlineFallbackRef.current = result.offlineFallback;
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load this chapter. Check your connection and try again.",
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [position, translation, reloadCount]);

  function goTo(next: Position) {
    setPosition(next);
    setLoading(true);
    setError(null);
    setVerses([]);
    setSelectionStart(null);
    setSelectionEnd(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    AsyncStorage.setItem(LAST_READ_KEY, JSON.stringify(next)).catch(() => {
      // Remembering the position is a convenience — ignore storage errors
    });
  }

  function handleVersePress(verse: number) {
    if (selectionStart === null || selectionEnd === null) {
      setSelectionStart(verse);
      setSelectionEnd(verse);
    } else if (verse < selectionStart) {
      // Tapping before the selection extends it backwards
      setSelectionStart(verse);
    } else if (verse > selectionEnd) {
      // Tapping after the selection extends it forwards
      setSelectionEnd(verse);
    } else if (selectionStart === selectionEnd) {
      // Tapping the only selected verse clears the selection
      setSelectionStart(null);
      setSelectionEnd(null);
    } else if (verse === selectionStart) {
      // Tapping the first verse drops it from the range
      setSelectionStart(selectionStart + 1);
    } else {
      // Tapping the last verse drops it; tapping inside the range ends it there
      setSelectionEnd(verse === selectionEnd ? selectionEnd - 1 : verse);
    }
  }

  function clearSelection() {
    setSelectionStart(null);
    setSelectionEnd(null);
  }

  function handleAddReflection() {
    if (
      !position ||
      !shownTranslation ||
      selectionStart === null ||
      selectionEnd === null
    ) {
      return;
    }
    setPassageDraft({
      translation: shownTranslation,
      book: position.book,
      chapter: position.chapter,
      verseStart: selectionStart,
      verseEnd: selectionEnd === selectionStart ? null : selectionEnd,
      verses: verses.filter(
        (v) => v.verse >= selectionStart && v.verse <= selectionEnd,
      ),
    });
    clearSelection();
    router.push("/snippet/create?fromReader=1");
  }

  function openPicker() {
    // Start on the testament of the book being read
    if (position) {
      setPickerTestament(BOOK_IDS[position.book] <= 39 ? "OT" : "NT");
    }
    setPickerBook(null);
    setPickerVisible(true);
  }

  function closePicker() {
    setPickerVisible(false);
    setPickerBook(null);
  }

  if (!position) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  const previous = getAdjacentChapter(position, -1);
  const next = getAdjacentChapter(position, 1);
  const hasSelection = selectionStart !== null && selectionEnd !== null;
  const selectionReference = hasSelection
    ? getDisplayReference({
        book: position.book,
        chapterStart: position.chapter,
        verseStart: selectionStart,
        chapterEnd: null,
        verseEnd: selectionEnd === selectionStart ? null : selectionEnd,
      })
    : null;

  // Pickers open as sheets on iOS, which start below the status bar
  const sheetTopInset =
    Platform.OS === "ios" ? spacing.lg : insets.top + spacing.md;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Chapter header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.chapterButton}
          onPress={openPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${position.book} ${position.chapter}, change chapter`}
        >
          <Text style={styles.chapterTitle} numberOfLines={1}>
            {position.book} {position.chapter}
          </Text>
          <Ionicons
            name="chevron-down"
            size={layout.iconSm}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <IconButton
            icon="chevron-back"
            onPress={() => previous && goTo(previous)}
            disabled={!previous}
            accessibilityLabel="Previous chapter"
            color={previous ? colors.textPrimary : colors.border}
          />
          <IconButton
            icon="chevron-forward"
            onPress={() => next && goTo(next)}
            disabled={!next}
            accessibilityLabel="Next chapter"
            color={next ? colors.textPrimary : colors.border}
          />
        </View>
      </View>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <View style={styles.errorState}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load this chapter"
            hint={error}
          />
          <Button
            label="Try again"
            variant="tonal"
            onPress={() => {
              setLoading(true);
              setError(null);
              setReloadCount((count) => count + 1);
            }}
          />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            hasSelection && styles.scrollWithBar,
          ]}
        >
          {offlineFallback ? (
            <View style={styles.offlineNote}>
              <Ionicons
                name="cloud-offline-outline"
                size={layout.iconSm}
                color={colors.textSecondary}
              />
              <Text style={styles.offlineNoteText}>
                {translation} needs a connection. Showing the King James
                Version.
              </Text>
              <TouchableOpacity
                onPress={() => setReloadCount((count) => count + 1)}
                hitSlop={spacing.sm}
              >
                <Text style={styles.offlineRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <Text style={styles.hint}>
            {shownTranslation} · Tap a verse to add a reflection
          </Text>
          {verses.map((v) => {
            const selected =
              hasSelection &&
              v.verse >= selectionStart &&
              v.verse <= selectionEnd;
            return (
              <Pressable
                key={v.verse}
                style={[styles.verseRow, selected && styles.verseRowSelected]}
                onPress={() => handleVersePress(v.verse)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={styles.verseNumber}>{v.verse}</Text>
                <Text style={styles.verseText}>{v.text}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Selection bar */}
      {hasSelection ? (
        <View style={styles.selectionBar}>
          <IconButton
            icon="close"
            onPress={clearSelection}
            accessibilityLabel="Clear selection"
            color={colors.textSecondary}
          />
          <Text style={styles.selectionReference} numberOfLines={1}>
            {selectionReference}
          </Text>
          <Button
            label="Add reflection"
            icon="create-outline"
            onPress={handleAddReflection}
            style={styles.selectionButton}
          />
        </View>
      ) : null}

      {/* Book and chapter picker */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePicker}
      >
        <View style={styles.screen}>
          <View style={[styles.modalHeader, { paddingTop: sheetTopInset }]}>
            <TouchableOpacity
              style={styles.modalCancelArea}
              onPress={() => (pickerBook ? setPickerBook(null) : closePicker())}
            >
              <Text style={styles.modalCancel}>
                {pickerBook ? "Books" : "Cancel"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{pickerBook ?? "Choose a book"}</Text>
            <View style={styles.modalCancelArea} />
          </View>

          {pickerBook ? (
            <ScrollView contentContainerStyle={styles.chapterGrid}>
              {Array.from(
                { length: getChapterCount(pickerBook) },
                (_, i) => i + 1,
              ).map((chapter) => {
                const current =
                  pickerBook === position.book && chapter === position.chapter;
                return (
                  <TouchableOpacity
                    key={chapter}
                    style={[
                      styles.chapterCell,
                      current && styles.chapterCellCurrent,
                    ]}
                    onPress={() => {
                      goTo({ book: pickerBook, chapter });
                      closePicker();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chapterCellText,
                        current && styles.chapterCellTextCurrent,
                      ]}
                    >
                      {chapter}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <>
              <View style={styles.testamentToggle}>
                {(
                  [
                    { key: "OT", label: "Old Testament" },
                    { key: "NT", label: "New Testament" },
                  ] as const
                ).map((testament) => {
                  const active = pickerTestament === testament.key;
                  return (
                    <TouchableOpacity
                      key={testament.key}
                      style={[
                        styles.testamentOption,
                        active && styles.testamentOptionActive,
                      ]}
                      onPress={() => setPickerTestament(testament.key)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.testamentText,
                          active && styles.testamentTextActive,
                        ]}
                      >
                        {testament.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <ScrollView
                key={pickerTestament}
                contentContainerStyle={styles.bookList}
              >
                {(pickerTestament === "OT" ? OT_BOOKS : NT_BOOKS).map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={styles.bookRow}
                    onPress={() => setPickerBook(name)}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.bookRowText,
                        name === position.book && styles.bookRowTextCurrent,
                      ]}
                    >
                      {name}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={layout.iconSm}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Chapter header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  chapterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chapterTitle: {
    ...typography.display,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  // Chapter text
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scrollWithBar: {
    paddingBottom: layout.controlHeight + spacing.xxl,
  },
  hint: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  offlineNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  offlineNoteText: {
    ...typography.label,
    flex: 1,
  },
  offlineRetry: {
    ...typography.label,
    color: colors.accent,
    fontWeight: "600",
  },
  verseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  verseRowSelected: {
    backgroundColor: colors.accentSoft,
  },
  verseNumber: {
    ...typography.caption,
    fontFamily: fonts.serifSemiBold,
    color: colors.accent,
    minWidth: spacing.md + spacing.xs,
    marginTop: spacing.sm,
  },
  verseText: {
    ...typography.scriptureLarge,
    flex: 1,
  },

  // Error
  errorState: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },

  // Selection bar
  selectionBar: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...shadows.floating,
  },
  selectionReference: {
    ...typography.reference,
    flex: 1,
  },
  selectionButton: {
    paddingHorizontal: spacing.md,
  },

  // Picker
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
  bookList: {
    paddingBottom: spacing.xl,
  },
  testamentToggle: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  testamentOption: {
    flex: 1,
    minHeight: layout.iconButton,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  testamentOptionActive: {
    backgroundColor: colors.accent,
  },
  testamentText: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  testamentTextActive: {
    color: colors.onAccent,
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
  bookRowTextCurrent: {
    color: colors.accent,
    fontWeight: "600",
  },
  chapterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  chapterCell: {
    width: layout.controlHeight,
    height: layout.controlHeight,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterCellCurrent: {
    backgroundColor: colors.accent,
  },
  chapterCellText: {
    ...typography.body,
  },
  chapterCellTextCurrent: {
    color: colors.onAccent,
    fontWeight: "600",
  },
});
