import { Button } from "@/src/components/Button";
import { IconButton } from "@/src/components/IconButton";
import { ListRow } from "@/src/components/ListRow";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { EmptyState, LoadingState } from "@/src/components/StateViews";
import {
  colors,
  layout,
  radius,
  spacing,
  typography,
} from "@/src/constants/theme";
import {
  type Topic,
  createTopic,
  deleteTopic,
  getAllTopics,
} from "@/src/db/topics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type TopicWithCount = Topic & { snippetCount: number };

export default function CustomTopicsScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [topicName, setTopicName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function openModal() {
    setTopicName("");
    setError(null);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
  }

  async function handleSave() {
    if (!topicName.trim()) {
      setError("Topic name is required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await createTopic(db, { name: topicName.trim(), type: "custom" });
      closeModal();
      await loadTopics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create topic.");
    } finally {
      setIsSaving(false);
    }
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
                onPress={openModal}
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

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.screen}>
          <View
            style={[
              styles.modalHeader,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <TouchableOpacity
              style={styles.modalCancelArea}
              onPress={closeModal}
              disabled={isSaving}
              hitSlop={spacing.sm}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Topic</Text>
            <View style={styles.modalCancelArea} />
          </View>

          <View style={styles.modalBody}>
            <TextInput
              style={styles.modalInput}
              value={topicName}
              onChangeText={setTopicName}
              placeholder="Topic name"
              placeholderTextColor={colors.textSecondary + "80"}
              autoFocus
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button
              label={isSaving ? "Saving…" : "Save"}
              onPress={handleSave}
              disabled={isSaving}
              style={styles.modalSaveButton}
            />
          </View>
        </View>
      </Modal>
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
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalCancelArea: {
    minWidth: layout.fab + spacing.sm,
  },
  modalCancel: {
    ...typography.button,
    color: colors.accent,
  },
  modalTitle: {
    ...typography.title,
    flex: 1,
    textAlign: "center",
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    lineHeight: undefined, // lineHeight on single-line TextInput clips descenders on iOS
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSaveButton: {
    marginTop: spacing.lg,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },
});
