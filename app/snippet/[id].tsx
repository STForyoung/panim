import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type Snippet, deleteSnippet, getSnippet } from "@/src/db/snippets";
import { type Topic } from "@/src/db/topics";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";

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

export default function SnippetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await getSnippet(db, id);
      if (!result) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const assignedTopics = await getTopicsForSnippet(db, id);
      setSnippet(result);
      setTopics(assignedTopics);
      setLoading(false);
    }
    load();
  }, [db, id]);

  function handleDelete() {
    Alert.alert(
      "Delete Snippet",
      "Are you sure you want to permanently delete this snippet?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSnippet(db, id);
            router.back();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (notFound || !snippet) {
    return (
      <View>
        <Text>Snippet not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView>
      <Text>{formatReference(snippet)}</Text>

      <Text>Passage</Text>
      <Text>{snippet.passage}</Text>

      <Text>Reflection</Text>
      <Text>{snippet.reflection}</Text>

      {topics.length > 0 ? (
        <View>
          <Text>Topics</Text>
          {topics.map((t) => (
            <Text key={t.id}>{t.name}</Text>
          ))}
        </View>
      ) : null}

      <TouchableOpacity onPress={() => router.push(`/snippet/edit/${id}`)}>
        <Text>Edit</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleDelete}>
        <Text>Delete</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
