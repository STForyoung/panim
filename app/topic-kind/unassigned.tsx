import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type Snippet, getAllSnippets } from "@/src/db/snippets";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";
import { SnippetCard } from "@/src/components/SnippetCard";
import { colors, spacing, typography } from "@/src/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function UnassignedSnippetsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSnippets = useCallback(async () => {
    const all = await getAllSnippets(db);
    const topicChecks = await Promise.all(
      all.map((s) => getTopicsForSnippet(db, s.id))
    );
    setSnippets(all.filter((_, i) => topicChecks[i].length === 0));
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSnippets();
    }, [loadSnippets])
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
        data={snippets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <Text style={styles.title}>Unassigned Snippets</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <SnippetCard
              snippet={item}
              onPress={() => router.push(`/snippet/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.mutedText}>No unassigned snippets.</Text>
          </View>
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
    padding: spacing.lg,
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
  cardWrapper: {
    marginBottom: spacing.sm,
  },
});
