import { Button } from "@/src/components/Button";
import { Fab } from "@/src/components/Fab";
import { FadeIn } from "@/src/components/FadeIn";
import { type IoniconName } from "@/src/components/IconButton";
import { PressableScale } from "@/src/components/PressableScale";
import { LoadingState } from "@/src/components/StateViews";
import { TopicChip } from "@/src/components/TopicChip";
import {
  colors,
  layout,
  radius,
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
import { toSuperscript } from "@/src/utils/superscript";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getGreetingIcon(): IoniconName {
  const hour = new Date().getHours();
  if (hour < 12) return "sunny-outline";
  if (hour < 17) return "partly-sunny-outline";
  return "moon-outline";
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
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const lastScheduleKey = useRef<string | null>(null);
  const lastSnippetCount = useRef<number>(0);

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
      } else if (schedule.mode === "favourites") {
        const favourites = await getFavouriteSnippets(db);
        pool = favourites.length === 0 ? snippets : favourites;
      }

      if (pool.length === 0) return;

      const picked = pickRandom(pool);
      const topics = await getTopicsForSnippet(db, picked.id);
      setCurrent(picked);
      setCurrentTopics(topics);
      setActiveTopicId(
        schedule.mode === "topic" ? (schedule.activeTopic ?? null) : null,
      );
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
        // Fall back to all snippets if pool is exhausted
        const comingUpSeq = next.length > 0 ? next : pickRandomN(snippets, 3, picked);
        setComingUp(comingUpSeq);
      } else {
        const fromPool = pickRandomN(pool, 3, picked);
        // Fall back to all snippets if pool is exhausted
        setComingUp(fromPool.length > 0 ? fromPool : pickRandomN(snippets, 3, picked));
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
        setNextReminder(getNextReminderTime(schedule.times));

        const scheduleKey = `${schedule.mode}:${schedule.activeTopic ?? ""}`;
        const scheduleChanged = lastScheduleKey.current !== scheduleKey;
        if (scheduleChanged) lastScheduleKey.current = scheduleKey;

        const snippetCountChanged = lastSnippetCount.current !== snippets.length;
        if (snippetCountChanged) lastSnippetCount.current = snippets.length;

        const snippetsById = new Map(snippets.map((s) => [s.id, s]));

        // Swap in the latest version of each Coming Up snippet (picks up edits)
        // and drop any that no longer exist (handles topic/snippet deletions).
        setComingUp((prev) =>
          prev.flatMap((s) => snippetsById.get(s.id) ?? []),
        );

        // Re-pick if: no current snippet, snippet was deleted, schedule changed, or new snippets added.
        setCurrent((prev) => {
          const latest = prev ? snippetsById.get(prev.id) : undefined;
          if (!prev || !latest || scheduleChanged || snippetCountChanged) {
            if (snippets.length > 0) {
              pickFromSchedule(snippets);
            }
            return prev;
          }
          // Same snippet stays on the card, but show its latest text and topics
          getTopicsForSnippet(db, latest.id).then(setCurrentTopics);
          return latest;
        });
      }
      onFocus();
    }, [db, pickFromSchedule]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (allSnippets.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <FadeIn style={styles.emptyContent}>
            <Text style={styles.emptyHeading}>Panim</Text>
            <Text style={styles.emptyBody}>
              Panim helps you meditate on scripture. Create snippets from Bible
              passages, reflect on them, and receive them as reminders
              throughout your day.
            </Text>
            <Button
              label="Create your first snippet"
              icon="add"
              onPress={() => router.push("/snippet/create")}
            />
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const displayTopics = activeTopicId
    ? currentTopics.filter((t) => t.id === activeTopicId)
    : currentTopics.filter((t) => t.type === "custom");

  function renderMiniCard({ item }: { item: Snippet }) {
    return (
      <PressableScale
        style={styles.miniCard}
        onPress={() => router.push(`/snippet/${item.id}`)}
        accessibilityRole="button"
      >
        <Text style={styles.miniCardReference}>{getDisplayReference(item)}</Text>
        <Text style={styles.miniCardPassage} numberOfLines={3}>
          {item.reflection || item.passage.map((v) => v.text).join(" ")}
        </Text>
      </PressableScale>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <FadeIn>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Ionicons
              name={getGreetingIcon()}
              size={layout.icon + spacing.xs}
              color={colors.accent}
            />
          </View>
          <View style={styles.reminderRow}>
            <Ionicons
              name="notifications-outline"
              size={layout.iconSm}
              color={colors.textSecondary}
            />
            <Text style={styles.reminderText}>
              {nextReminder ??
                "Set a schedule in Settings to start receiving reminders"}
            </Text>
          </View>
        </FadeIn>

        {/* Next in Playlist */}
        {current ? (
          <FadeIn delay={80}>
            <PressableScale
              style={styles.hero}
              scaleTo={0.985}
              dim={false}
              onPress={() => router.push(`/snippet/${current.id}`)}
              accessibilityRole="button"
            >
              <Text style={styles.heroEyebrow}>Next in your playlist</Text>
              <Text style={styles.heroPassage} numberOfLines={4}>
                {current.passage.map((v, i) => (
                  <Text key={`${v.chapter}-${v.verse}`}>
                    {i > 0 ? " " : ""}
                    <Text style={styles.heroVerseNumber}>
                      {toSuperscript(v.verse)}
                    </Text>
                    {"\u00A0"}
                    {v.text}
                  </Text>
                ))}
              </Text>
              <Text style={styles.heroReference}>
                {getDisplayReference(current)}
              </Text>

              {displayTopics.length > 0 ? (
                <View style={styles.topicsRow}>
                  {displayTopics.map((t) => (
                    <TopicChip key={t.id} name={t.name} />
                  ))}
                </View>
              ) : null}

              {current.reflection ? (
                <View style={styles.heroReflection}>
                  <View style={styles.heroReflectionBar} />
                  <Text style={styles.heroReflectionText} numberOfLines={4}>
                    {current.reflection}
                  </Text>
                </View>
              ) : null}
            </PressableScale>
          </FadeIn>
        ) : null}

        {/* Coming Up */}
        {comingUp.length > 0 ? (
          <FadeIn delay={160}>
            <Text style={styles.sectionTitle}>Coming up</Text>
            <FlatList
              horizontal
              data={comingUp}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
              renderItem={renderMiniCard}
            />
          </FadeIn>
        ) : null}

        {/* Favourites */}
        <FadeIn delay={240}>
          <Text style={styles.sectionTitle}>Favourites</Text>
          {favourites.length === 0 ? (
            <Text style={styles.emptyFavourites}>
              Open a snippet and tap the heart to keep it here.
            </Text>
          ) : (
            <FlatList
              horizontal
              data={favourites}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
              renderItem={renderMiniCard}
            />
          )}
        </FadeIn>
      </ScrollView>

      <Fab
        onPress={() => router.push("/snippet/create")}
        accessibilityLabel="New snippet"
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
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    // Leaves room for the floating button
    paddingBottom: layout.fab + spacing.xxl,
  },

  // Empty state
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyHeading: {
    ...typography.display,
    marginBottom: spacing.md,
  },
  emptyBody: {
    ...typography.scripture,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },

  // Greeting
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + spacing.xs,
    marginTop: spacing.md,
  },
  greeting: {
    ...typography.display,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  reminderText: {
    ...typography.label,
    flex: 1,
  },

  // Hero snippet
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  heroEyebrow: {
    ...typography.label,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  heroPassage: {
    ...typography.scriptureHero,
  },
  heroVerseNumber: {
    color: colors.accent,
  },
  heroReference: {
    ...typography.reference,
    color: colors.accent,
    marginTop: spacing.lg,
  },
  topicsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroReflection: {
    flexDirection: "row",
    backgroundColor: colors.accentTint,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  heroReflectionBar: {
    width: spacing.xs - 1,
    backgroundColor: colors.accent,
  },
  heroReflectionText: {
    ...typography.bodySmall,
    flex: 1,
    padding: spacing.md,
    color: colors.textSecondary,
  },

  // Sections
  sectionTitle: {
    ...typography.title,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  // Carousels run edge to edge, past the screen padding
  carousel: {
    marginHorizontal: -spacing.lg,
  },
  carouselContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  miniCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md + spacing.xs,
    width: layout.miniCardWidth,
    gap: spacing.sm,
  },
  miniCardReference: {
    ...typography.reference,
    color: colors.accent,
  },
  miniCardPassage: {
    ...typography.reflection,
  },

  // Favourites empty
  emptyFavourites: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
