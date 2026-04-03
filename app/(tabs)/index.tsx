import { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { type Snippet, getAllSnippets, getFavouriteSnippets } from "@/src/db/snippets";
import { type Topic } from "@/src/db/topics";
import { getSnippetsForTopic, getTopicsForSnippet } from "@/src/db/snippetTopics";
import { getSchedule } from "@/src/db/notificationSchedule";

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function pickRandom<T>(arr: T[], exclude?: T): T {
  const pool = exclude ? arr.filter((item) => item !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomN<T>(arr: T[], n: number, exclude?: T): T[] {
  const pool = exclude ? arr.filter((item) => item !== exclude) : arr;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allSnippets, setAllSnippets] = useState<Snippet[]>([]);
  const [current, setCurrent] = useState<Snippet | null>(null);
  const [currentTopics, setCurrentTopics] = useState<Topic[]>([]);
  const [comingUp, setComingUp] = useState<Snippet[]>([]);
  const [favourites, setFavourites] = useState<Snippet[]>([]);

  useEffect(() => {
    async function load() {
      const [snippets, schedule, favs] = await Promise.all([
        getAllSnippets(db),
        getSchedule(db),
        getFavouriteSnippets(db),
      ]);

      setAllSnippets(snippets);
      setFavourites(favs);

      if (snippets.length === 0) {
        setLoading(false);
        return;
      }

      // Determine snippet pool based on schedule mode
      let pool: Snippet[] = snippets;

      if (schedule.mode === "topic") {
        if (!schedule.activeTopic) {
          // activeTopic is null — fall back to random from all snippets
          pool = snippets;
        } else {
          const topicSnippets = await getSnippetsForTopic(db, schedule.activeTopic);
          if (topicSnippets.length === 0) {
            // activeTopic has no snippets — fall back to random from all snippets
            pool = snippets;
          } else {
            pool = topicSnippets;
          }
        }
      }

      const picked = pickRandom(pool);
      const topics = await getTopicsForSnippet(db, picked.id);
      setCurrent(picked);
      setCurrentTopics(topics);

      // Coming Up: next 3 snippets
      if (schedule.selectionOrder === "sequential") {
        // NOTE: lastSentIndex is never incremented in MVP, so this list will
        // always start from index 0. Post-MVP: increment lastSentIndex after
        // each notification is sent and persist it via updateSchedule.
        const startIndex = schedule.lastSentIndex % pool.length;
        const next: Snippet[] = [];
        for (let i = 1; i <= 3; i++) {
          const s = pool[(startIndex + i) % pool.length];
          if (s && s.id !== picked.id) next.push(s);
        }
        setComingUp(next);
      } else {
        setComingUp(pickRandomN(pool, 3, picked));
      }

      setLoading(false);
    }
    load();
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      getFavouriteSnippets(db).then(setFavourites);
    }, [db])
  );

  async function handleNewSnippet() {
    if (allSnippets.length === 0) return;
    const picked = pickRandom(allSnippets, current ?? undefined);
    const topics = await getTopicsForSnippet(db, picked.id);
    setCurrent(picked);
    setCurrentTopics(topics);
    setComingUp(pickRandomN(allSnippets, 3, picked));
  }

  if (loading) {
    return (
      <View>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (allSnippets.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text>{getGreeting()}</Text>
        <Text>Welcome to Panim</Text>
        <Text>
          Panim helps you meditate on scripture. Create snippets from Bible
          passages, reflect on them, and receive them as reminders throughout
          your day.
        </Text>
        <TouchableOpacity onPress={() => router.push("/snippet/create")}>
          <Text>Create Your First Snippet</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text>{getGreeting()}</Text>

      <TouchableOpacity onPress={() => router.push("/snippet/create")}>
        <Text>+ New Snippet</Text>
      </TouchableOpacity>

      {/* Next in Playlist */}
      {current ? (
        <View>
          <Text>Next in Playlist</Text>
          <Text>{formatReference(current)}</Text>
          {currentTopics.length > 0 ? (
            <View>
              {currentTopics.map((t) => (
                <Text key={t.id}>{t.name}</Text>
              ))}
            </View>
          ) : null}
          <Text>{current.passage}</Text>
          <Text>{current.reflection}</Text>

          <TouchableOpacity onPress={() => router.push(`/snippet/${current.id}`)}>
            <Text>View Snippet</Text>
          </TouchableOpacity>

          {allSnippets.length > 1 ? (
            <TouchableOpacity onPress={handleNewSnippet}>
              <Text>New Snippet</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Coming Up */}
      {comingUp.length > 0 ? (
        <View>
          <Text>Coming Up</Text>
          {comingUp.map((snippet) => (
            <TouchableOpacity
              key={snippet.id}
              onPress={() => router.push(`/snippet/${snippet.id}`)}
            >
              <Text>{formatReference(snippet)}</Text>
              <Text numberOfLines={1}>{snippet.passage}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Favourites */}
      <View>
        <Text>Favourites</Text>
        {favourites.length === 0 ? (
          <Text>Tap a snippet and use the favourite button to save it here.</Text>
        ) : (
          <FlatList
            horizontal
            data={favourites}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => router.push(`/snippet/${item.id}`)}>
                <Text>{formatReference(item)}</Text>
                <Text numberOfLines={1}>{item.passage}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </ScrollView>
  );
}
