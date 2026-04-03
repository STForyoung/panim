import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type Topic, createTopic, deleteTopic, getAllTopics } from "@/src/db/topics";
import { getSnippetsForTopic } from "@/src/db/snippetTopics";

type TopicWithCount = Topic & { snippetCount: number };

export default function ConceptualTopicsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [topics, setTopics] = useState<TopicWithCount[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [topicName, setTopicName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    const all = await getAllTopics(db);
    const conceptual = all.filter((t) => t.type === "conceptual");
    const withCounts = await Promise.all(
      conceptual.map(async (t) => {
        const snippets = await getSnippetsForTopic(db, t.id);
        return { ...t, snippetCount: snippets.length };
      })
    );
    setTopics(withCounts);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadTopics();
    }, [loadTopics])
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
      await createTopic(db, { name: topicName.trim(), type: "conceptual" });
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

  return (
    <View>
      <TouchableOpacity onPress={openModal}>
        <Text>New Conceptual Topic</Text>
      </TouchableOpacity>

      <FlatList
        data={topics}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/topic/${item.id}`)}
            onLongPress={() => handleLongPress(item)}
          >
            <Text>{item.name}</Text>
            <Text>{item.snippetCount} snippet{item.snippetCount === 1 ? "" : "s"}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No conceptual topics yet.</Text>}
      />

      <Modal visible={modalVisible} animationType="slide">
        <View>
          <Text>New Conceptual Topic</Text>

          <Text>Name</Text>
          <TextInput
            value={topicName}
            onChangeText={setTopicName}
            placeholder="Topic name"
            autoFocus
          />

          {error ? <Text>{error}</Text> : null}

          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            <Text>{isSaving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={closeModal} disabled={isSaving}>
            <Text>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
