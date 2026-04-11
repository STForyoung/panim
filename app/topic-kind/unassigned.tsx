import { SnippetCard } from "@/src/components/SnippetCard";
import { colors, spacing, typography } from "@/src/constants/theme";
import { type Snippet, getAllSnippets } from "@/src/db/snippets";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";
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
    setSnippets(all.filter((_, i) => topicChecks[i].every((t) => t.type !== "conceptual")));
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
          <View>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Unassigned Snippets</Text>
          </View>
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
  backText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardWrapper: {
    marginBottom: spacing.sm,
  },
});
