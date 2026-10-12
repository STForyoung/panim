import {
  type NotificationSchedule,
  getSchedule,
} from "@/src/db/notificationSchedule";
import { getAllSnippets, getFavouriteSnippets, type Snippet } from "@/src/db/snippets";
import { getSnippetsForTopic } from "@/src/db/snippetTopics";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";
import { type SQLiteDatabase } from "expo-sqlite";

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

// Simple first-sentence heuristic: split on ". " (period + space) and take
// the first segment. Works for most scripture passages but may occasionally
// include abbreviations (e.g. "vs. ") in the first segment. Good enough for MVP.
function firstSentence(text: string): string {
  return text.split(". ")[0];
}

export function getNextReminderTime(times: string[]): string | null {
  if (times.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Parse all times into total minutes
  const parsed = times.map((t) => {
    const [h, m] = t.split(":").map(Number);
    return { totalMinutes: h * 60 + m, hour: h, minute: m };
  });

  // Find the next time later today
  const todayNext = parsed.find((t) => t.totalMinutes > nowMinutes);

  function formatTime(hour: number, minute: string, suffix: string): string {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${minute} ${suffix}`;
  }

  if (todayNext) {
    const suffix = todayNext.hour < 12 ? "AM" : "PM";
    const minute = String(todayNext.minute).padStart(2, "0");
    return `Next reminder at ${formatTime(todayNext.hour, minute, suffix)}`;
  }

  // No times left today — return the first time tomorrow
  const first = parsed[0];
  const suffix = first.hour < 12 ? "AM" : "PM";
  const minute = String(first.minute).padStart(2, "0");
  return `Next reminder tomorrow at ${formatTime(first.hour, minute, suffix)}`;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Reminders work through a saved playlist of snippet ids. Because no app code runs when a
// notification fires, the playlist is turned into individual dated notifications ahead of
// time and topped up each time the app is opened.

const PLAYLIST_KEY = "reminderPlaylist";
const QUEUE_KEY = "reminderQueue";

// iOS keeps at most 64 pending notifications per app
const MAX_SCHEDULED = 60;
const HORIZON_DAYS = 14;

type Playlist = {
  // Inputs the queue was last built from; scheduling is skipped while this is unchanged
  signature: string;
  // Selection the order belongs to: mode, topic and order setting
  key: string;
  // Every snippet id in the pool at the last sync, used to spot newly added snippets
  known: string[];
  // Rest of the last pass that did not fit in the scheduled queue
  tail: string[];
  // Number of the pass the tail belongs to
  pass: number;
  // Most recent snippet a reminder was sent for
  lastSentId: string | null;
};

// pass counts trips through the playlist, so the end of the current one can be found
type QueueEntry = { fireAt: number; snippetId: string; pass: number };

type Upcoming = { id: string; pass: number };

async function readMeta<T>(db: SQLiteDatabase, key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = ?",
    key,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function writeMeta(db: SQLiteDatabase, key: string, value: unknown) {
  await db.runAsync(
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    key,
    JSON.stringify(value),
  );
}

// Snippets reminders are drawn from. An empty topic or no favourites falls back to everything.
export async function getReminderPool(
  db: SQLiteDatabase,
  schedule: NotificationSchedule,
): Promise<Snippet[]> {
  const allSnippets = await getAllSnippets(db);
  if (schedule.mode === "topic" && schedule.activeTopic) {
    const topicSnippets = await getSnippetsForTopic(db, schedule.activeTopic);
    return topicSnippets.length === 0 ? allSnippets : topicSnippets;
  }
  if (schedule.mode === "favourites") {
    const favourites = await getFavouriteSnippets(db);
    return favourites.length === 0 ? allSnippets : favourites;
  }
  return allSnippets;
}

function shuffle(ids: string[]): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A fresh pass through every snippet, never opening with the one just sent
function newCycle(
  orderedIds: string[],
  sequential: boolean,
  previousId: string | null,
): string[] {
  if (sequential) return [...orderedIds];
  const cycle = shuffle(orderedIds);
  if (cycle.length > 1 && cycle[0] === previousId) {
    [cycle[0], cycle[1]] = [cycle[1], cycle[0]];
  }
  return cycle;
}

// Upcoming reminder times, soonest first, limited by count and by the horizon.
// refreshAt is the first time after those, used for the notice to reopen the app.
function getSlotTimes(
  times: string[],
  now: number,
  count: number,
): { slots: number[]; refreshAt: number | null } {
  const parsed = times
    .map((t) => t.split(":").map(Number))
    .sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
  const slots: number[] = [];
  if (parsed.length === 0) return { slots, refreshAt: null };

  // One day past the horizon is scanned so there is always a time left for the notice
  for (let day = 0; day <= HORIZON_DAYS; day++) {
    for (const [hour, minute] of parsed) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      date.setHours(hour, minute, 0, 0);
      if (date.getTime() <= now) continue;
      if (day === HORIZON_DAYS || slots.length === count) {
        return { slots, refreshAt: date.getTime() };
      }
      slots.push(date.getTime());
    }
  }
  return { slots, refreshAt: null };
}

function getReminderBody(
  snippet: Snippet,
  content: NotificationSchedule["notificationContent"],
): string {
  const passageText = snippet.passage.map((v) => v.text).join(" ");
  if (content === "prayer" && snippet.prayer?.trim()) {
    return firstSentence(snippet.prayer);
  }
  if (content !== "passage" && snippet.reflection?.trim()) {
    return firstSentence(snippet.reflection);
  }
  return firstSentence(passageText);
}

function dateTrigger(fireAt: number): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(fireAt),
    ...(Platform.OS === "android" && { channelId: "default" }),
  };
}

async function syncReminders(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();
  const [schedule, permissions] = await Promise.all([
    getSchedule(db),
    Notifications.getPermissionsAsync(),
  ]);
  const granted = permissions.status === "granted";
  const sequential = schedule.selectionOrder === "sequential";

  const pool = await getReminderPool(db, schedule);
  const snippetsById = new Map(pool.map((s) => [s.id, s]));
  // Oldest first is the fixed order; shuffled order is drawn from the same list
  const orderedIds = [...pool]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((s) => s.id);

  const playlist = await readMeta<Playlist>(db, PLAYLIST_KEY);
  const queue = (await readMeta<QueueEntry[]>(db, QUEUE_KEY)) ?? [];
  const sent = queue.filter((entry) => entry.fireAt <= now);
  const pending = queue.filter((entry) => entry.fireAt > now);

  const key = `${schedule.mode}:${schedule.activeTopic ?? ""}:${schedule.selectionOrder}`;
  const signature = JSON.stringify([
    key,
    schedule.times,
    schedule.notificationContent,
    granted,
    pool.map((s) => `${s.id}:${s.updatedAt}`),
  ]);

  // Nothing changed and no reminder has fired since the last run — the queue is still right
  if (playlist?.signature === signature && sent.length === 0) return;

  const lastSentId =
    sent.length > 0
      ? sent[sent.length - 1].snippetId
      : (playlist?.lastSentId ?? null);

  const startPass = (ids: string[], pass: number): Upcoming[] =>
    ids.map((id) => ({ id, pass }));

  // Order already decided for the reminders still to come
  let upcoming: Upcoming[];
  let lastPass = playlist?.pass ?? 0;
  if (!playlist || playlist.key !== key) {
    lastPass += 1;
    upcoming = startPass(newCycle(orderedIds, sequential, lastSentId), lastPass);
  } else if (sequential) {
    // Carry on from the snippet after the last one sent
    const lastIndex = lastSentId ? orderedIds.indexOf(lastSentId) : -1;
    upcoming = startPass(orderedIds.slice(lastIndex + 1), lastPass);
  } else {
    upcoming = [
      ...pending.map((entry) => ({ id: entry.snippetId, pass: entry.pass ?? 0 })),
      ...startPass(playlist.tail, lastPass),
    ].filter((entry) => snippetsById.has(entry.id));
    const known = new Set(playlist.known);
    const added = orderedIds.filter((id) => !known.has(id));
    if (added.length > 0 && upcoming.length > 0) {
      // Keep only the rest of the current pass, so later passes are rebuilt with the new snippets
      const currentPass = upcoming[0].pass;
      upcoming = upcoming.filter((entry) => entry.pass === currentPass);
      lastPass = currentPass;
      // New snippets join at a random place among the ones still to come in this pass
      for (const id of added) {
        const index = Math.floor(Math.random() * (upcoming.length + 1));
        upcoming.splice(index, 0, { id, pass: currentPass });
      }
    }
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  // One of the allowed notifications is kept for the notice asking the user to open the app
  const { slots, refreshAt } =
    granted && orderedIds.length > 0
      ? getSlotTimes(schedule.times, now, MAX_SCHEDULED - 1)
      : { slots: [], refreshAt: null };

  const nextQueue: QueueEntry[] = [];
  let previousId = lastSentId;
  for (const fireAt of slots) {
    if (upcoming.length === 0) {
      lastPass += 1;
      upcoming = startPass(newCycle(orderedIds, sequential, previousId), lastPass);
    }
    const { id: snippetId, pass } = upcoming.shift()!;
    const snippet = snippetsById.get(snippetId)!;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: formatReference(snippet),
        body: getReminderBody(snippet, schedule.notificationContent),
        sound: "default",
        data: { snippetId },
      },
      trigger: dateTrigger(fireAt),
    });
    nextQueue.push({ fireAt, snippetId, pass });
    previousId = snippetId;
  }

  if (refreshAt !== null) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Panim",
        body: "Open Panim to refresh your reminders.",
        sound: "default",
      },
      trigger: dateTrigger(refreshAt),
    });
  }

  await writeMeta(db, QUEUE_KEY, nextQueue);
  await writeMeta(db, PLAYLIST_KEY, {
    signature,
    key,
    known: orderedIds,
    tail: upcoming.map((entry) => entry.id),
    pass: lastPass,
    lastSentId,
  } satisfies Playlist);
}

// Runs are chained so two callers can never cancel and reschedule at the same time
let syncChain: Promise<void> = Promise.resolve();

// Brings the reminder playlist and the phone's scheduled notifications up to date.
// Safe to call often: it does nothing unless something changed or a reminder has fired.
export function scheduleNotifications(db: SQLiteDatabase): Promise<void> {
  const run = syncChain.then(() => syncReminders(db));
  syncChain = run.catch(() => {
    // A failed run must not block later ones
  });
  return run;
}

// The snippets the next reminders will send, soonest first, without repeats
export async function getUpcomingReminders(
  db: SQLiteDatabase,
  count: number,
): Promise<Snippet[]> {
  const now = Date.now();
  const [playlist, queue, schedule] = await Promise.all([
    readMeta<Playlist>(db, PLAYLIST_KEY),
    readMeta<QueueEntry[]>(db, QUEUE_KEY),
    getSchedule(db),
  ]);
  const pool = await getReminderPool(db, schedule);
  const snippetsById = new Map(pool.map((s) => [s.id, s]));

  const ids = [
    ...(queue ?? []).filter((e) => e.fireAt > now).map((e) => e.snippetId),
    ...(playlist?.tail ?? []),
    // Fills the list when the playlist is shorter than asked for, or not built yet
    ...pool.map((s) => s.id),
  ];

  const result: Snippet[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const snippet = snippetsById.get(id);
    if (!snippet || seen.has(id)) continue;
    seen.add(id);
    result.push(snippet);
    if (result.length === count) break;
  }
  return result;
}

export function handleNotificationTap(
  response: Notifications.NotificationResponse,
): void {
  const snippetId = response.notification.request.content.data?.snippetId;
  if (typeof snippetId === "string") {
    router.push(`/snippet/${snippetId}`);
  }
}
