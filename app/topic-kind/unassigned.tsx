import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SnippetCard } from "@/src/components/SnippetCard";
import { EmptyState, LoadingState } from "@/src/components/StateViews";
import { colors, spacing, typography } from "@/src/constants/theme";
import { type Snippet, getAllSnippets } from "@/src/db/snippets";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function UnassignedSnippetsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSnippets = useCallback(async () => {
    const all = await getAllSnippets(db);
    const topicChecks = await Promise.all(
      all.map((s) => getTopicsForSnippet(db, s.id)),
    );
    setSnippets(all.filter((_, i) => topicChecks[i].every((t) => t.type !== "custom")));
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSnippets();
    }, [loadSnippets]),
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
        data={snippets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <View>
            <ScreenHeader onBack={() => router.back()} />
            <Text style={styles.title}>Unassigned Snippets</Text>
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
            icon="file-tray-outline"
            title="No unassigned snippets"
            hint="Every snippet belongs to one of your topics."
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
  title: {
    ...typography.display,
    marginBottom: spacing.sm,
  },
});
