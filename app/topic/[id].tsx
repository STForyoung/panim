import { Ionicons } from "@expo/vector-icons";
import { SnippetCard } from "@/src/components/SnippetCard";
import { colors, radius, spacing, typography } from "@/src/constants/theme";
import { type Snippet } from "@/src/db/snippets";
import { getSnippetsForTopic } from "@/src/db/snippetTopics";
import { type Topic, deleteTopic, getTopic } from "@/src/db/topics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

    const message =
      snippets.length > 0
        ? `"${topic.name}" has ${snippets.length} snippet${snippets.length === 1 ? "" : "s"}. Deleting this topic will not delete those snippets — they will become unassigned.`
        : `Are you sure you want to delete "${topic.name}"?`;

    Alert.alert("Delete Topic", message, [
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
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredState}>
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !topic) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredState}>
          <Text style={styles.mutedText}>Topic not found.</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButtonState}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const snippetCountLabel =
    snippets.length === 1 ? "1 snippet" : `${snippets.length} snippets`;

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={snippets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <View>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={styles.topicName}>{topic.name}</Text>

            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{topic.type}</Text>
            </View>

            <Text style={styles.snippetCount}>{snippetCountLabel}</Text>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.newSnippetButton}
              onPress={() => router.push(`/snippet/create?topicId=${id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.newSnippetButtonText}>+ New Snippet</Text>
            </TouchableOpacity>
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
          <View style={styles.emptyState}>
            <Text style={styles.mutedText}>No snippets in this topic.</Text>
            <Text style={styles.emptyHint}>
              Create a snippet and assign it to this topic.
            </Text>
          </View>
        }
        ListFooterComponent={
          topic?.type !== 'book' ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteText}>Delete Topic</Text>
            </TouchableOpacity>
          ) : null
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
  backButtonState: {
    marginTop: spacing.md,
  },

  // Back button
  backButton: {
    marginBottom: spacing.lg,
  },

  // Header
  topicName: {
    ...typography.heading,
    marginBottom: spacing.xs,
  },
  typePill: {
    backgroundColor: colors.accent + "26",
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  typePillText: {
    ...typography.label,
    color: colors.accent,
  },
  snippetCount: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  // Snippet cards
  cardWrapper: {
    marginBottom: spacing.sm,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    marginTop: spacing.xl,
  },
  mutedText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptyHint: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },

  // New Snippet button
  newSnippetButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  newSnippetButtonText: {
    ...typography.button,
    color: colors.surface,
  },

  // Delete button
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  deleteText: {
    ...typography.button,
    color: colors.danger,
  },
});
