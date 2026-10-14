import { BookPicker } from "@/src/components/BookPicker";
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
  type ChapterResult,
  TRANSLATION_NAMES,
  fetchChapter,
  getChapterCount,
} from "@/src/services/bibleService";
import { setPassageDraft } from "@/src/services/passageDraft";
import { getDisplayReference } from "@/src/utils/displayReference";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LAST_READ_KEY = "lastRead";
const DEFAULT_POSITION = { book: "John", chapter: 1 };

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
  const scrollRef = useRef<ScrollView>(null);

  const [position, setPosition] = useState<Position | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [verses, setVerses] = useState<PassageVerse[]>([]);
  // What is actually on screen, which is the bundled translation when offline
  const [shownTranslation, setShownTranslation] = useState<string | null>(null);
  // Why the bundled translation is showing instead of the chosen one, if it is
  const [fallback, setFallback] = useState<ChapterResult["fallback"]>(null);
  const offlineFallbackRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // Selected verse range within the current chapter
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

  // Book and chapter picker
  const [pickerVisible, setPickerVisible] = useState(false);

  // A snippet's "Read in context" link opens this tab at its passage:
  // /bible?book=John&chapter=3&verseStart=16&verseEnd=17&at=<timestamp>
  const request = useLocalSearchParams<{
    book?: string;
    chapter?: string;
    verseStart?: string;
    verseEnd?: string;
    at?: string;
  }>();
  // Verses to point out and scroll to after arriving from a snippet
  const [marked, setMarked] = useState<{ start: number; end: number } | null>(
    null,
  );
  const hasPosition = useRef(false);

  // Opens the requested passage, or on first load the last chapter that was open
  useEffect(() => {
    let cancelled = false;

    async function open() {
      const chapter = parseInt(request.chapter ?? "", 10);
      const requested =
        request.book &&
        BOOK_IDS[request.book] &&
        chapter >= 1 &&
        chapter <= getChapterCount(request.book)
          ? { book: request.book, chapter }
          : null;

      let target: Position;
      if (requested) {
        target = requested;
        await AsyncStorage.setItem(LAST_READ_KEY, JSON.stringify(target)).catch(
          () => {},
        );
      } else {
        if (hasPosition.current) return;
        const value = await AsyncStorage.getItem(LAST_READ_KEY).catch(() => null);
        const saved: Position | null = value ? JSON.parse(value) : null;
        target = saved && BOOK_IDS[saved.book] ? saved : DEFAULT_POSITION;
      }
      if (cancelled) return;

      const start = parseInt(request.verseStart ?? "", 10);
      const end = parseInt(request.verseEnd ?? "", 10);
      hasPosition.current = true;
      setPosition(target);
      setMarked(
        requested && start >= 1
          ? { start, end: end >= start ? end : start }
          : null,
      );
      setLoading(true);
      setError(null);
      setVerses([]);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
    open();

    return () => {
      cancelled = true;
    };
  }, [request.at, request.book, request.chapter, request.verseStart, request.verseEnd]);

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
        setFallback(result.fallback);
        offlineFallbackRef.current = result.fallback === "offline";
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
    setMarked(null);
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

  if (!position) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  const translationName =
    (translation && TRANSLATION_NAMES[translation]) ?? translation;
  const isMarked = (verse: number) =>
    marked !== null && verse >= marked.start && verse <= marked.end;
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


  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Chapter header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.chapterButton}
          onPress={() => setPickerVisible(true)}
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
          {fallback ? (
            <View style={styles.offlineNote}>
              <Ionicons
                name={
                  fallback === "removed"
                    ? "alert-circle-outline"
                    : "cloud-offline-outline"
                }
                size={layout.iconSm}
                color={colors.textSecondary}
              />
              <Text style={styles.offlineNoteText}>
                {fallback === "removed"
                  ? `${translationName} is no longer available. Showing the King James Version. Choose another version in Settings.`
                  : `${translationName} needs a connection. Showing the King James Version.`}
              </Text>
              {fallback === "offline" ? (
                <TouchableOpacity
                  onPress={() => setReloadCount((count) => count + 1)}
                  hitSlop={spacing.sm}
                >
                  <Text style={styles.offlineRetry}>Retry</Text>
                </TouchableOpacity>
              ) : null}
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
                style={[
                  styles.verseRow,
                  isMarked(v.verse) && styles.verseRowMarked,
                  selected && styles.verseRowSelected,
                ]}
                // Bring the passage a snippet pointed to into view
                onLayout={
                  marked?.start === v.verse
                    ? (e) =>
                        scrollRef.current?.scrollTo({
                          y: Math.max(e.nativeEvent.layout.y - spacing.lg, 0),
                          animated: false,
                        })
                    : undefined
                }
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
      <BookPicker
        visible={pickerVisible}
        selectedBook={position.book}
        selectedChapter={position.chapter}
        onSelectChapter={(book, chapter) => {
          goTo({ book, chapter });
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
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
  // The passage a snippet pointed to
  verseRowMarked: {
    backgroundColor: colors.accentTint,
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

});
