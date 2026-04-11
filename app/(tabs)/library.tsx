import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/constants/theme";
import { getAllSnippets } from "@/src/db/snippets";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";
import { getAllTopics } from "@/src/db/topics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SectionItem = {
  key: string;
  label: string;
  route:
    | "/topic-kind/conceptual"
    | "/topic-kind/book"
    | "/topic-kind/unassigned";
  count: number;
  countLabel: string;
};

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [sections, setSections] = useState<SectionItem[]>([
    {
      key: "conceptual",
      label: "Conceptual Topics",
      route: "/topic-kind/conceptual",
      count: 0,
      countLabel: "0 topics",
    },
    {
      key: "book",
      label: "Book Topics",
      route: "/topic-kind/book",
      count: 0,
      countLabel: "0 topics",
    },
    {
      key: "unassigned",
      label: "Unassigned Snippets",
      route: "/topic-kind/unassigned",
      count: 0,
      countLabel: "0 snippets",
    },
  ]);

  const loadCounts = useCallback(async () => {
    const [topics, snippets] = await Promise.all([
      getAllTopics(db),
      getAllSnippets(db),
    ]);

    const conceptualCount = topics.filter(
      (t) => t.type === "conceptual",
    ).length;
    const directedCount = topics.filter((t) => t.type === "book").length;

    const topicChecks = await Promise.all(
      snippets.map((s) => getTopicsForSnippet(db, s.id)),
    );
    const unassignedCount = topicChecks.filter((t) => t.length === 0).length;

    setSections([
      {
        key: "conceptual",
        label: "Conceptual Topics",
        route: "/topic-kind/conceptual",
        count: conceptualCount,
        countLabel:
          conceptualCount === 1 ? "1 topic" : `${conceptualCount} topics`,
      },
      {
        key: "book",
        label: "Book Topics",
        route: "/topic-kind/book",
        count: directedCount,
        countLabel: directedCount === 1 ? "1 topic" : `${directedCount} topics`,
      },
      {
        key: "unassigned",
        label: "Unassigned Snippets",
        route: "/topic-kind/unassigned",
        count: unassignedCount,
        countLabel:
          unassignedCount === 1 ? "1 snippet" : `${unassignedCount} snippets`,
      },
    ]);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Library</Text>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push("/snippet/create")}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>+ Create Snippet</Text>
        </TouchableOpacity>

        {sections.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            onPress={() => router.push(item.route)}
            activeOpacity={0.7}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardCount}>{item.countLabel}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
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
    padding: spacing.lg,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Title
  title: {
    ...typography.heading,
    marginBottom: spacing.lg,
  },

  // Create button
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  createButtonText: {
    ...typography.button,
    color: colors.surface,
  },

  // Nav cards
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
});
