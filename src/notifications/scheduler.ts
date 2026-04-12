import { getSchedule } from "@/src/db/notificationSchedule";
import { getAllSnippets, type Snippet } from "@/src/db/snippets";
import { getSnippetsForTopic } from "@/src/db/snippetTopics";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
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

export async function scheduleNotifications(db: SQLiteDatabase): Promise<void> {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") return;

  const schedule = await getSchedule(db);

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (schedule.times.length === 0) return;

  const allSnippets = await getAllSnippets(db);
  if (allSnippets.length === 0) return;

  // Determine snippet pool
  let pool: Snippet[] = allSnippets;
  if (schedule.mode === "topic") {
    if (!schedule.activeTopic) {
      // activeTopic is null — fall back to all snippets
      pool = allSnippets;
    } else {
      const topicSnippets = await getSnippetsForTopic(db, schedule.activeTopic);
      if (topicSnippets.length === 0) {
        // activeTopic has no snippets — fall back to all snippets
        pool = allSnippets;
      } else {
        pool = topicSnippets;
      }
    }
  }

  for (const time of schedule.times) {
    if (pool.length === 0) continue;

    const [hourStr, minuteStr] = time.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    let snippet: Snippet;
    if (schedule.selectionOrder === "sequential") {
      snippet = pool[schedule.lastSentIndex % pool.length];
    } else {
      snippet = pool[Math.floor(Math.random() * pool.length)];
    }

    const body = snippet.prayer
      ? firstSentence(snippet.prayer)
      : snippet.reflection?.trim()
        ? firstSentence(snippet.reflection)
        : firstSentence(snippet.passage);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: formatReference(snippet),
        body,
        data: { snippetId: snippet.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }
}

export function handleNotificationTap(
  response: Notifications.NotificationResponse,
): void {
  const snippetId = response.notification.request.content.data?.snippetId;
  if (typeof snippetId === "string") {
    router.push(`/snippet/${snippetId}`);
  }
}
