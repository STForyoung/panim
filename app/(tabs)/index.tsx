import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/constants/theme";
import { getSchedule } from "@/src/db/notificationSchedule";
import {
  type Snippet,
  getAllSnippets,
  getFavouriteSnippets,
} from "@/src/db/snippets";
import {
  getSnippetsForTopic,
  getTopicsForSnippet,
} from "@/src/db/snippetTopics";
import { type Topic } from "@/src/db/topics";
import { getNextReminderTime } from "@/src/notifications/scheduler";
import { getDisplayReference } from "@/src/utils/displayReference";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const [nextReminder, setNextReminder] = useState<string | null>(null);

  const pickFromSchedule = useCallback(
    async (snippets: Snippet[]) => {
      const schedule = await getSchedule(db);
      let pool: Snippet[] = snippets;
      if (schedule.mode === "topic") {
        if (!schedule.activeTopic) {
          pool = snippets;
        } else {
          const topicSnippets = await getSnippetsForTopic(
            db,
            schedule.activeTopic,
          );
          pool = topicSnippets.length === 0 ? snippets : topicSnippets;
        }
      }

      if (pool.length === 0) return;

      const picked = pickRandom(pool);
      const topics = await getTopicsForSnippet(db, picked.id);
      setCurrent(picked);
      setCurrentTopics(topics);
      setNextReminder(getNextReminderTime(schedule.times));

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
    },
    [db],
  );

  useEffect(() => {
    async function load() {
      const [snippets, favs] = await Promise.all([
        getAllSnippets(db),
        getFavouriteSnippets(db),
      ]);
      setAllSnippets(snippets);
      setFavourites(favs);
      if (snippets.length > 0) {
        await pickFromSchedule(snippets);
      }
      setLoading(false);
    }
    load();
  }, [db, pickFromSchedule]);

  useFocusEffect(
    useCallback(() => {
      async function onFocus() {
        const [snippets, favs, schedule] = await Promise.all([
          getAllSnippets(db),
          getFavouriteSnippets(db),
          getSchedule(db),
        ]);
        setAllSnippets(snippets);
        setFavourites(favs);

        if (snippets.length > 0) {
          await pickFromSchedule(snippets);
        } else {
          setNextReminder(getNextReminderTime(schedule.times));
        }
      }
      onFocus();
    }, [db, pickFromSchedule]),
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
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (allSnippets.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Text style={styles.emptyHeading}>Panim</Text>
          <Text style={styles.emptyBody}>
            Panim helps you meditate on scripture. Create snippets from Bible
            passages, reflect on them, and receive them as reminders throughout
            your day.
          </Text>
          <TouchableOpacity
            style={styles.newSnippetButton}
            onPress={() => router.push("/snippet/create")}
            activeOpacity={0.8}
          >
            <Text style={styles.newSnippetButtonText}>
              Create Your First Snippet
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.greeting}>{getGreeting()}</Text>

        <TouchableOpacity
          style={styles.newSnippetButton}
          onPress={() => router.push("/snippet/create")}
          activeOpacity={0.8}
        >
          <Text style={styles.newSnippetButtonText}>+ New Snippet</Text>
        </TouchableOpacity>

        {/* Next in Playlist */}
        {current ? (
          <View>
            <Text style={styles.sectionLabel}>NEXT IN PLAYLIST</Text>
            <View style={styles.card}>
              <Text style={styles.cardReference}>
                {getDisplayReference(current).toUpperCase()}
              </Text>

              {currentTopics.length > 0 ? (
                <View style={styles.topicsRow}>
                  {currentTopics.map((t) => (
                    <Text key={t.id} style={styles.topicName}>
                      {t.name}
                    </Text>
                  ))}
                </View>
              ) : null}

              <Text style={styles.reminderText}>
                {nextReminder ??
                  "Set a schedule in Settings to start receiving reminders"}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.cardReflection} numberOfLines={5}>
                {current.reflection}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.cardPassage} numberOfLines={5}>
                {current.passage}
              </Text>

              <View style={styles.cardButtons}>
                {allSnippets.length > 1 ? (
                  <TouchableOpacity
                    style={styles.buttonOutline}
                    onPress={handleNewSnippet}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.buttonOutlineText}>New Snippet</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.buttonFilled}
                  onPress={() => router.push(`/snippet/${current.id}`)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonFilledText}>View Snippet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* Coming Up */}
        {comingUp.length > 0 ? (
          <View>
            <Text style={styles.sectionLabel}>COMING UP</Text>
            <FlatList
              horizontal
              data={comingUp}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => (
                <View style={{ width: spacing.md }} />
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.miniCard}
                  onPress={() => router.push(`/snippet/${item.id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.miniCardReference}>
                    {getDisplayReference(item)}
                  </Text>
                  <Text style={styles.miniCardPassage} numberOfLines={1}>
                    {item.passage}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}

        {/* Favourites */}
        <View>
          <Text style={styles.sectionLabel}>FAVOURITES</Text>
          {favourites.length === 0 ? (
            <Text style={styles.emptyFavourites}>
              Tap a snippet and use the favourite button to save it here.
            </Text>
          ) : (
            <FlatList
              horizontal
              data={favourites}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => (
                <View style={{ width: spacing.md }} />
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.miniCard}
                  onPress={() => router.push(`/snippet/${item.id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.miniCardReference}>
                    {getDisplayReference(item)}
                  </Text>
                  <Text style={styles.miniCardPassage} numberOfLines={1}>
                    {item.passage}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </ScrollView>
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

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  emptyHeading: {
    ...typography.heading,
    marginBottom: spacing.xl,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },

  // Greeting
  greeting: {
    ...typography.heading,
    marginBottom: spacing.xs,
  },

  // New Snippet button
  newSnippetButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  newSnippetButtonText: {
    ...typography.button,
    color: colors.surface,
  },

  // Section label
  sectionLabel: {
    ...typography.label,
    letterSpacing: 1.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Main playlist card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  cardReference: {
    ...typography.reference,
  },
  topicsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  topicName: {
    ...typography.label,
    color: colors.accent,
  },
  reminderText: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  cardPassage: {
    ...typography.scriptureItalic,
    marginTop: spacing.sm,
  },
  cardReflection: {
    ...typography.scripture,
  },
  cardButtons: {
    flexDirection: "row",
    marginTop: spacing.md,
  },
  buttonOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginRight: spacing.sm,
  },
  buttonOutlineText: {
    ...typography.button,
    color: colors.accent,
  },
  buttonFilled: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  buttonFilledText: {
    ...typography.button,
    color: colors.surface,
  },

  // Mini cards (Coming Up + Favourites)
  miniCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    width: 180,
    ...shadows.card,
  },
  miniCardReference: {
    ...typography.reference,
  },
  miniCardPassage: {
    ...typography.scripture,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },

  // Favourites empty
  emptyFavourites: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
