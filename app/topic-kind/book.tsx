import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/constants/theme";
import { getSnippetsForTopic } from "@/src/db/snippetTopics";
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

export default function BookTopicsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [topicName, setTopicName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    const all = await getAllTopics(db);
    const book = all.filter((t) => t.type === "book");
    const withCounts = await Promise.all(
      book.map(async (t) => {
        const snippets = await getSnippetsForTopic(db, t.id);
        return { ...t, snippetCount: snippets.length };
      }),
    );
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
      await createTopic(db, { name: topicName.trim(), type: "book" });
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
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Book Topics</Text>
            <TouchableOpacity
              style={styles.newButton}
              onPress={openModal}
              activeOpacity={0.8}
            >
              <Text style={styles.newButtonText}>+ New Book Topic</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/topic/${item.id}`)}
            onLongPress={() => handleLongPress(item)}
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
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.mutedText}>No book topics yet.</Text>
          </View>
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
              hitSlop={8}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Book Topic</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <TextInput
              style={styles.modalInput}
              value={topicName}
              onChangeText={setTopicName}
              placeholder="e.g. Romans"
              placeholderTextColor={colors.textSecondary + "80"}
              autoFocus
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[
                styles.newButton,
                styles.modalSaveButton,
                isSaving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={styles.newButtonText}>
                {isSaving ? "Saving…" : "Save"}
              </Text>
            </TouchableOpacity>
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

  // Header
  title: {
    ...typography.heading,
    marginBottom: spacing.lg,
  },

  // New button
  newButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  newButtonText: {
    ...typography.button,
    color: colors.surface,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Topic cards
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

  // Modal
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCancelArea: {
    minWidth: 60,
  },
  modalCancel: {
    ...typography.button,
    color: colors.accent,
  },
  modalTitle: {
    ...typography.heading,
    flex: 1,
    textAlign: "center",
    fontSize: 17,
  },
  modalHeaderSpacer: {
    minWidth: 60,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  modalSaveButton: {
    marginTop: spacing.lg,
    marginBottom: 0,
  },
  backText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },
});
