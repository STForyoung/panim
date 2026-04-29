import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/constants/theme";
import { type Topic, getAllTopics } from "@/src/db/topics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
        <View style={styles.centered}>
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
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
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.title}>Bible Books</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/topic/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardCount}>
                {item.snippetCount === 1
                  ? "1 snippet"
                  : `${item.snippetCount} snippets`}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
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
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  centered: {
    alignItems: "center",
    marginTop: spacing.xl,
  },
  mutedText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  title: {
    ...typography.heading,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  cardLeft: {
    flex: 1,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: "600",
  },
  cardCount: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  chevron: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
});
