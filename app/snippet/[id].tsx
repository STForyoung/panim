import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type Snippet, deleteSnippet, getSnippet, toggleFavourite } from "@/src/db/snippets";
import { type Topic } from "@/src/db/topics";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";
import { FadeIn } from "@/src/components/FadeIn";
import { IconButton } from "@/src/components/IconButton";
import { PassageText } from "@/src/components/PassageText";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { EmptyState, LoadingState } from "@/src/components/StateViews";
import { TopicChip } from "@/src/components/TopicChip";
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
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (notFound || !snippet) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.notFound}>
          <ScreenHeader onBack={() => router.back()} />
          <EmptyState icon="help-circle-outline" title="Snippet not found" />
        </View>
      </SafeAreaView>
    );
  }

  const isFavourite = !!snippet.isFavourite;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader onBack={() => router.back()}>
          <IconButton
            icon={isFavourite ? "heart" : "heart-outline"}
            color={isFavourite ? colors.accent : colors.textSecondary}
            accessibilityLabel={
              isFavourite ? "Remove from favourites" : "Add to favourites"
            }
            onPress={async () => {
              const next = !isFavourite;
              await toggleFavourite(db, id, next);
              setSnippet({ ...snippet, isFavourite: next });
            }}
          />
          <IconButton
            icon="create-outline"
            color={colors.textSecondary}
            accessibilityLabel="Edit snippet"
            onPress={() => router.push(`/snippet/edit/${id}`)}
          />
          <IconButton
            icon="trash-outline"
            color={colors.textSecondary}
            accessibilityLabel="Delete snippet"
            onPress={handleDelete}
          />
        </ScreenHeader>

        <FadeIn>
          {/* Reference */}
          <Text style={styles.reference}>{getDisplayReference(snippet)}</Text>

          {/* Topic chips */}
          {topics.length > 0 ? (
            <View style={styles.chips}>
              {topics.map((t) => (
                <TopicChip key={t.id} name={t.name} />
              ))}
            </View>
          ) : null}

          {/* Passage */}
          <View style={styles.passage}>
            <PassageText verses={snippet.passage} large />
          </View>

          {snippet.reflection ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My reflection</Text>
              <Text style={styles.sectionText}>{snippet.reflection}</Text>
            </View>
          ) : null}

          {/* Prayer */}
          {snippet.prayer ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My prayer</Text>
              <Text style={styles.sectionText}>{snippet.prayer}</Text>
            </View>
          ) : null}
        </FadeIn>
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  notFound: {
    flex: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // Reference
  reference: {
    ...typography.display,
  },

  // Topic chips
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  // Passage
  passage: {
    marginTop: spacing.xl,
  },

  // Reflection and prayer
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  sectionText: {
    ...typography.reflectionLarge,
    color: colors.textSoft,
  },
});
