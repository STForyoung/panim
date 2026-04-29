import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type Snippet, deleteSnippet, getSnippet, toggleFavourite } from "@/src/db/snippets";
import { type Topic } from "@/src/db/topics";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";
import { PassageText } from "@/src/components/PassageText";
import { getDisplayReference } from "@/src/utils/displayReference";
import { colors, radius, spacing, typography } from "@/src/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SnippetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const result = await getSnippet(db, id);
        if (!result) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const assignedTopics = await getTopicsForSnippet(db, id);
        setSnippet(result);
        setTopics(assignedTopics);
        setLoading(false);
      }
      load();
    }, [db, id])
  );

  function handleDelete() {
    Alert.alert(
      "Delete Snippet",
      "Are you sure you want to permanently delete this snippet?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSnippet(db, id);
            router.back();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredState}>
          <Text style={styles.stateText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !snippet) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredState}>
          <Text style={styles.stateText}>Snippet not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonState}>
            <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFavourite = !!snippet.isFavourite;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header row */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/snippet/edit/${id}`)} hitSlop={8}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Reference */}
        <Text style={styles.reference}>
          {getDisplayReference(snippet).toUpperCase()}
        </Text>

        {/* Topic chips */}
        {topics.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {topics.map((t) => (
              <View key={t.id} style={styles.chip}>
                <Text style={styles.chipText}>{t.name}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.divider} />

        {/* Passage */}
        <Text style={styles.sectionLabel}>PASSAGE</Text>
        <PassageText verses={snippet.passage} />

        {snippet.reflection ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>MY REFLECTION</Text>
            <Text style={styles.reflectionText}>{snippet.reflection}</Text>
          </>
        ) : null}

        {/* Prayer */}
        {snippet.prayer ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>MY PRAYER</Text>
            <Text style={styles.prayerText}>{snippet.prayer}</Text>
          </>
        ) : null}

        {/* Favourite button */}
        <TouchableOpacity
          style={isFavourite ? styles.favButtonFilled : styles.favButtonOutline}
          activeOpacity={0.8}
          onPress={async () => {
            const next = !isFavourite;
            await toggleFavourite(db, id, next);
            setSnippet({ ...snippet, isFavourite: next });
          }}
        >
          <Text style={isFavourite ? styles.favButtonFilledText : styles.favButtonOutlineText}>
            {isFavourite ? "★ Remove from Favourites" : "☆ Add to Favourites"}
          </Text>
        </TouchableOpacity>

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteButton}
          activeOpacity={0.8}
          onPress={handleDelete}
        >
          <Text style={styles.deleteText}>Delete Snippet</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  // Loading / not found
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  backButtonState: {
    marginTop: spacing.md,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  editText: {
    ...typography.button,
    color: colors.accent,
  },

  // Reference
  reference: {
    ...typography.reference,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },

  // Topic chips
  chipsScroll: {
    marginBottom: spacing.sm,
  },
  chipsContent: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  chip: {
    backgroundColor: colors.accent + "26", // 15% opacity
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    ...typography.label,
    color: colors.accent,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  // Section label
  sectionLabel: {
    ...typography.label,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Reflection
  reflectionText: {
    ...typography.scripture,
  },

  // Passage
  // Prayer
  prayerText: {
    ...typography.scripture,
  },

  // Favourite button
  favButtonFilled: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  favButtonFilledText: {
    ...typography.button,
    color: colors.surface,
  },
  favButtonOutline: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  favButtonOutlineText: {
    ...typography.button,
    color: colors.accent,
  },

  // Delete button
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  deleteText: {
    ...typography.button,
    color: colors.danger,
  },
});
