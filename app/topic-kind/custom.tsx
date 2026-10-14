import { IconButton } from "@/src/components/IconButton";
import { ListRow } from "@/src/components/ListRow";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { EmptyState, LoadingState } from "@/src/components/StateViews";
import { TopicNameSheet } from "@/src/components/TopicNameSheet";
import { colors, spacing, typography } from "@/src/constants/theme";
import {
  type Topic,
  createTopic,
  deleteTopic,
  getAllTopics,
} from "@/src/db/topics";
import { scheduleNotifications } from "@/src/notifications/scheduler";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TopicWithCount = Topic & { snippetCount: number };

export default function CustomTopicsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const loadTopics = useCallback(async () => {
    const all = await getAllTopics(db);
    const custom = all.filter((t) => t.type === "custom");
    const counts = await db.getAllAsync<{ topicId: string; count: number }>(
      `SELECT topicId, COUNT(*) as count FROM snippet_topics
       WHERE topicId IN (SELECT id FROM topics WHERE type = 'custom')
       GROUP BY topicId`
    );
    const countMap = Object.fromEntries(counts.map((r) => [r.topicId, r.count]));
    const withCounts = custom.map((t) => ({ ...t, snippetCount: countMap[t.id] ?? 0 }));
    setTopics(withCounts);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadTopics();
    }, [loadTopics]),
  );

  async function handleCreate(name: string) {
    await createTopic(db, { name, type: "custom" });
    setModalVisible(false);
    await loadTopics();
  }

  async function handleLongPress(topic: TopicWithCount) {
    const message =
      topic.snippetCount > 0
        ? `"${topic.name}" has ${topic.snippetCount} snippet${topic.snippetCount === 1 ? "" : "s"}. Deleting this topic will not delete those snippets — they will become unorganized.`
        : `Are you sure you want to delete "${topic.name}"?`;

    Alert.alert("Delete Topic", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTopic(db, topic.id);
          await scheduleNotifications(db).catch(() => {});
          await loadTopics();
        },
      },
    ]);
  }

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
            <ScreenHeader onBack={() => router.back()}>
              <IconButton
                icon="add"
                onPress={() => setModalVisible(true)}
                accessibilityLabel="New topic"
                color={colors.accent}
              />
            </ScreenHeader>
            <Text style={styles.title}>My Topics</Text>
            {topics.length > 0 ? (
              <Text style={styles.hint}>Press and hold a topic to delete it.</Text>
            ) : null}
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
            onLongPress={() => handleLongPress(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="pricetags-outline"
            title="No topics yet"
            hint="Tap + to create your first topic."
          />
        }
      />

      <TopicNameSheet
        visible={modalVisible}
        title="New Topic"
        onSave={handleCreate}
        onClose={() => setModalVisible(false)}
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
  },
  hint: {
    ...typography.label,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
