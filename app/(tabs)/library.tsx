import { useCallback, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getAllTopics } from "@/src/db/topics";
import { getAllSnippets } from "@/src/db/snippets";
import { getTopicsForSnippet } from "@/src/db/snippetTopics";

type SectionItem = {
  key: string;
  label: string;
  route: "/topic-kind/conceptual" | "/topic-kind/directed" | "/topic-kind/unassigned";
  count: number;
};

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [sections, setSections] = useState<SectionItem[]>([
    { key: "conceptual", label: "Conceptual Topics", route: "/topic-kind/conceptual", count: 0 },
    { key: "directed", label: "Directed Topics", route: "/topic-kind/directed", count: 0 },
    { key: "unassigned", label: "Unassigned Snippets", route: "/topic-kind/unassigned", count: 0 },
  ]);

  const loadCounts = useCallback(async () => {
    const [topics, snippets] = await Promise.all([
      getAllTopics(db),
      getAllSnippets(db),
    ]);

    const conceptualCount = topics.filter((t) => t.type === "conceptual").length;
    const directedCount = topics.filter((t) => t.type === "directed").length;

    const topicChecks = await Promise.all(
      snippets.map((s) => getTopicsForSnippet(db, s.id))
    );
    const unassignedCount = topicChecks.filter((t) => t.length === 0).length;

    setSections([
      { key: "conceptual", label: "Conceptual Topics", route: "/topic-kind/conceptual", count: conceptualCount },
      { key: "directed", label: "Directed Topics", route: "/topic-kind/directed", count: directedCount },
      { key: "unassigned", label: "Unassigned Snippets", route: "/topic-kind/unassigned", count: unassignedCount },
    ]);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  return (
    <View>
      <TouchableOpacity onPress={() => router.push("/snippet/create")}>
        <Text>+ Create Snippet</Text>
      </TouchableOpacity>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(item.route)}>
            <View>
              <Text>{item.label}</Text>
              <Text>{item.count}</Text>
            </View>
            <Text>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
