import { ListRow } from "@/src/components/ListRow";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { LoadingState } from "@/src/components/StateViews";
import { colors, spacing, typography } from "@/src/constants/theme";
import { type Topic, getAllTopics } from "@/src/db/topics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TopicWithCount = Topic & { snippetCount: number };

export default function BookTopicsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTopics = useCallback(async () => {
    const all = await getAllTopics(db);
    const book = all.filter((t) => t.type === "book");
    const counts = await db.getAllAsync<{ topicId: string; count: number }>(
      `SELECT topicId, COUNT(*) as count FROM snippet_topics
       WHERE topicId IN (SELECT id FROM topics WHERE type = 'book')
       GROUP BY topicId`
    );
    const countMap = Object.fromEntries(counts.map((r) => [r.topicId, r.count]));
    const withCounts = book.map((t) => ({ ...t, snippetCount: countMap[t.id] ?? 0 }));
    setTopics(withCounts);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadTopics();
    }, [loadTopics]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={topics}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <View>
            <ScreenHeader onBack={() => router.back()} />
            <Text style={styles.title}>Bible Books</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={
              item.snippetCount === 1
                ? "1 snippet"
                : `${item.snippetCount} snippets`
            }
            onPress={() => router.push(`/topic/${item.id}`)}
          />
        )}
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
    gap: spacing.sm,
  },
  title: {
    ...typography.display,
    marginBottom: spacing.md,
  },
});
