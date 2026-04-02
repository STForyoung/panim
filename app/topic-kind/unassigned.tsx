import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type Snippet, getAllSnippets } from "@/src/db/snippets";
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

export default function UnassignedSnippetsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [snippets, setSnippets] = useState<Snippet[]>([]);

  const loadSnippets = useCallback(async () => {
    const all = await getAllSnippets(db);
    const topicChecks = await Promise.all(
      all.map((s) => getTopicsForSnippet(db, s.id))
    );
    setSnippets(all.filter((_, i) => topicChecks[i].length === 0));
  }, [db]);

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  return (
    <View>
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
        ListEmptyComponent={<Text>No unassigned snippets.</Text>}
      />
    </View>
  );
}
