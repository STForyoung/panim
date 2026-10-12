import { Fab } from "@/src/components/Fab";
import { FadeIn } from "@/src/components/FadeIn";
import { type IoniconName } from "@/src/components/IconButton";
import { ListRow } from "@/src/components/ListRow";
import { LoadingState } from "@/src/components/StateViews";
import { colors, layout, spacing, typography } from "@/src/constants/theme";
import { getAllSnippets } from "@/src/db/snippets";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";
import { getAllTopics } from "@/src/db/topics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SectionItem = {
  key: string;
  label: string;
  route: "/topic-kind/custom" | "/topic-kind/book" | "/topic-kind/unassigned";
  count: number;
  countLabel: string;
};

const SECTION_ICONS: Record<string, IoniconName> = {
  custom: "pricetags-outline",
  book: "book-outline",
  unassigned: "file-tray-outline",
};

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [sections, setSections] = useState<SectionItem[]>([
    {
      key: "custom",
      label: "My Topics",
      route: "/topic-kind/custom",
      count: 0,
      countLabel: "0 topics",
    },
    {
      key: "book",
      label: "Bible Books",
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

    const customCount = topics.filter((t) => t.type === "custom").length;
    const directedCount = topics.filter((t) => t.type === "book").length;

    const topicChecks = await Promise.all(
      snippets.map((s) => getTopicsForSnippet(db, s.id)),
    );
    const unassignedCount = topicChecks.filter((t) =>
      t.every((topic) => topic.type !== "custom"),
    ).length;

    setSections([
      {
        key: "custom",
        label: "My Topics",
        route: "/topic-kind/custom",
        count: customCount,
        countLabel: customCount === 1 ? "1 topic" : `${customCount} topics`,
      },
      {
        key: "book",
        label: "Bible Books",
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
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FadeIn>
          <Text style={styles.title}>Library</Text>
          <Text style={styles.subtitle}>
            Your snippets, gathered by topic and by book.
          </Text>

          <View style={styles.list}>
            {sections.map((item) => (
              <ListRow
                key={item.key}
                title={item.label}
                subtitle={item.countLabel}
                icon={SECTION_ICONS[item.key]}
                onPress={() => router.push(item.route)}
              />
            ))}
          </View>
        </FadeIn>
      </ScrollView>

      <Fab
        onPress={() => router.push("/snippet/create")}
        accessibilityLabel="New snippet"
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
    // Leaves room for the floating button
    paddingBottom: layout.fab + spacing.xxl,
  },
  title: {
    ...typography.display,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
});
