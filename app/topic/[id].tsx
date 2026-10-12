import { IconButton } from "@/src/components/IconButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SnippetCard } from "@/src/components/SnippetCard";
import { EmptyState, LoadingState } from "@/src/components/StateViews";
import { colors, spacing, typography } from "@/src/constants/theme";
import { type Snippet } from "@/src/db/snippets";
import { getSnippetsForTopic } from "@/src/db/snippetTopics";
import { type Topic, deleteTopic, getTopic } from "@/src/db/topics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const result = await getTopic(db, id);
        if (!result) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const topicSnippets = await getSnippetsForTopic(db, id);
        setTopic(result);
        setSnippets(topicSnippets);
        setLoading(false);
      }
      load();
    }, [db, id]),
  );

  function handleDelete() {
    if (!topic) return;

    if (snippets.length === 0) {
      Alert.alert("Delete Topic", `Are you sure you want to delete "${topic.name}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTopic(db, id);
            router.back();
          },
        },
      ]);
      return;
    }

    const count = snippets.length;
    const snippetLabel = count === 1 ? "1 snippet" : `${count} snippets`;

    Alert.alert(
      "Delete Topic",
      `"${topic.name}" has ${snippetLabel}. What would you like to do?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Topic Only",
          onPress: async () => {
            await deleteTopic(db, id);
            router.back();
          },
        },
        {
          text: "Delete Topic & Snippets",
          style: "destructive",
          onPress: async () => {
            await db.runAsync(
              `DELETE FROM snippets WHERE id IN (
                SELECT snippetId FROM snippet_topics WHERE topicId = ?
              )`,
              id,
            );
            await deleteTopic(db, id);
            router.back();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (notFound || !topic) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.notFound}>
          <ScreenHeader onBack={() => router.back()} />
          <EmptyState icon="help-circle-outline" title="Topic not found" />
        </View>
      </SafeAreaView>
    );
  }

  const snippetCountLabel =
    snippets.length === 1 ? "1 snippet" : `${snippets.length} snippets`;
  const kindLabel = topic.type === "book" ? "Bible book" : "My topic";

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={snippets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <View>
            <ScreenHeader onBack={() => router.back()}>
              {topic.type !== "book" ? (
                <IconButton
                  icon="trash-outline"
                  onPress={handleDelete}
                  accessibilityLabel="Delete topic"
                  color={colors.textSecondary}
                />
              ) : null}
              <IconButton
                icon="add"
                onPress={() => router.push(`/snippet/create?topicId=${id}`)}
                accessibilityLabel="New snippet in this topic"
                color={colors.accent}
              />
            </ScreenHeader>

            <Text style={styles.topicName}>{topic.name}</Text>
            <Text style={styles.meta}>
              {kindLabel} · {snippetCountLabel}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SnippetCard
            snippet={item}
            onPress={() => router.push(`/snippet/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="leaf-outline"
            title="No snippets in this topic"
            hint="Tap + to add one."
          />
        }
      />
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
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  notFound: {
    flex: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  topicName: {
    ...typography.display,
  },
  meta: {
    ...typography.label,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
