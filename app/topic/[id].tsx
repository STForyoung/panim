import { useCallback, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type Topic, deleteTopic, getTopic } from "@/src/db/topics";
import { type Snippet } from "@/src/db/snippets";
import { getSnippetsForTopic } from "@/src/db/snippetTopics";

function formatReference(snippet: Snippet): string {
  const { book, chapterStart, verseStart, chapterEnd, verseEnd } = snippet;
  if (chapterEnd !== null && verseEnd !== null && chapterEnd !== chapterStart) {
    return `${book} ${chapterStart}:${verseStart}-${chapterEnd}:${verseEnd}`;
  }
  if (verseEnd !== null) {
    return `${book} ${chapterStart}:${verseStart}-${verseEnd}`;
  }
  return `${book} ${chapterStart}:${verseStart}`;
}

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
    }, [db, id])
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
      <View>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (notFound || !topic) {
    return (
      <View>
        <Text>Topic not found.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>{topic.name}</Text>
      <Text>{topic.type}</Text>

      <FlatList
        data={snippets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/snippet/${item.id}`)}>
            <Text>{formatReference(item)}</Text>
            <Text numberOfLines={2}>{item.passage}</Text>
            <Text numberOfLines={2}>{item.reflection}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>No snippets in this topic.</Text>}
      />

      <TouchableOpacity onPress={handleDelete}>
        <Text>Delete Topic</Text>
      </TouchableOpacity>
    </View>
  );
}
