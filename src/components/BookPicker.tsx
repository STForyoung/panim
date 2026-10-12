import { Chevron } from "@/src/components/Icons";
import {
  colors,
  layout,
  radius,
  spacing,
  typography,
} from "@/src/constants/theme";
import {
  BOOK_IDS,
  CANONICAL_BOOKS,
  getChapterCount,
} from "@/src/services/bibleService";
import { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Testament = "OT" | "NT";

const TESTAMENTS: { key: Testament; label: string; books: string[] }[] = [
  {
    key: "OT",
    label: "Old Testament",
    books: CANONICAL_BOOKS.filter((name) => BOOK_IDS[name] <= 39),
  },
  {
    key: "NT",
    label: "New Testament",
    books: CANONICAL_BOOKS.filter((name) => BOOK_IDS[name] >= 40),
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  // Book to highlight; the picker opens on its testament
  selectedBook?: string | null;
  // Chapter to highlight, when chapters are being picked
  selectedChapter?: number | null;
  // Pick a book only (forms)
  onSelectBook?: (book: string) => void;
  // Pick a book, then a chapter from a grid (Bible tab)
  onSelectChapter?: (book: string, chapter: number) => void;
};

// Sheet for choosing a Bible book, with an Old/New Testament switch
export function BookPicker({ visible, onClose, ...rest }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* Mounted per opening, so it always starts from the current selection */}
      {visible ? <PickerContent onClose={onClose} {...rest} /> : null}
    </Modal>
  );
}

function PickerContent({
  onClose,
  selectedBook,
  selectedChapter,
  onSelectBook,
  onSelectChapter,
}: Omit<Props, "visible">) {
  const insets = useSafeAreaInsets();
  const [testament, setTestament] = useState<Testament>(
    selectedBook && BOOK_IDS[selectedBook] <= 39 ? "OT" : "NT",
  );
  // Set once a book is chosen and a chapter still has to be picked
  const [chapterBook, setChapterBook] = useState<string | null>(null);

  // Sheets start below the status bar on iOS; Android shows the modal full screen
  const topInset = Platform.OS === "ios" ? spacing.lg : insets.top + spacing.md;

  function handleBookPress(name: string) {
    if (onSelectChapter) {
      setChapterBook(name);
    } else {
      onSelectBook?.(name);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => (chapterBook ? setChapterBook(null) : onClose())}
          hitSlop={spacing.sm}
        >
          <Text style={styles.headerAction}>
            {chapterBook ? "Books" : "Cancel"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.title}>{chapterBook ?? "Choose a book"}</Text>
        <View style={styles.headerSide} />
      </View>

      {chapterBook ? (
        <ScrollView contentContainerStyle={styles.chapterGrid}>
          {Array.from(
            { length: getChapterCount(chapterBook) },
            (_, i) => i + 1,
          ).map((chapter) => {
            const current =
              chapterBook === selectedBook && chapter === selectedChapter;
            return (
              <TouchableOpacity
                key={chapter}
                style={[styles.chapterCell, current && styles.chapterCellCurrent]}
                onPress={() => onSelectChapter?.(chapterBook, chapter)}
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
          <View style={styles.toggle}>
            {TESTAMENTS.map(({ key, label }) => {
              const active = testament === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.toggleOption, active && styles.toggleOptionActive]}
                  onPress={() => setTestament(key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.toggleText, active && styles.toggleTextActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ScrollView key={testament} contentContainerStyle={styles.bookList}>
            {TESTAMENTS.find((t) => t.key === testament)!.books.map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.bookRow}
                onPress={() => handleBookPress(name)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.bookRowText,
                    name === selectedBook && styles.bookRowTextCurrent,
                  ]}
                >
                  {name}
                </Text>
                {onSelectChapter ? <Chevron /> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerSide: {
    minWidth: layout.fab + spacing.sm,
  },
  headerAction: {
    ...typography.button,
    color: colors.accent,
  },
  title: {
    ...typography.title,
    flex: 1,
    textAlign: "center",
  },

  // Testament switch
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  toggleOption: {
    flex: 1,
    minHeight: layout.iconButton,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleOptionActive: {
    backgroundColor: colors.accent,
  },
  toggleText: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: colors.onAccent,
  },

  // Books
  bookList: {
    paddingBottom: spacing.xl,
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

  // Chapters
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
