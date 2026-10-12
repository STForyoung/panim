import { type SQLiteDatabase } from 'expo-sqlite';

export type NotificationSchedule = {
  id: string;
  times: string[];
  mode: 'random' | 'topic' | 'favourites';
  activeTopic: string | null;
  selectionOrder: 'random' | 'sequential';
  lastSentIndex: number;
  translation: 'KJV' | 'BSB' | 'NKJV' | 'ESV' | 'NASB' | 'NLT';
  notificationContent: 'passage' | 'reflection' | 'prayer';
};

const SINGLETON_ID = 'singleton';

const TRANSLATIONS: NotificationSchedule['translation'][] = ['KJV', 'BSB', 'NKJV', 'ESV', 'NASB', 'NLT'];

const DEFAULT_SCHEDULE: NotificationSchedule = {
  id: SINGLETON_ID,
  times: [],
  mode: 'random',
  activeTopic: null,
  selectionOrder: 'random',
  lastSentIndex: 0,
  translation: 'KJV',
  notificationContent: 'passage',
};

type RawRow = Omit<NotificationSchedule, 'times' | 'translation' | 'notificationContent'> & {
  times: string;
  translation: string;
  notificationContent: string | null;
};

function parseRow(row: RawRow): NotificationSchedule {
  return {
    ...row,
    times: JSON.parse(row.times) as string[],
    // A stored translation that is no longer offered (e.g. NIV) falls back to the default
    translation: TRANSLATIONS.includes(row.translation as NotificationSchedule['translation'])
      ? (row.translation as NotificationSchedule['translation'])
      : DEFAULT_SCHEDULE.translation,
    notificationContent: (row.notificationContent as NotificationSchedule['notificationContent']) ?? 'passage',
  };
}

export async function getSchedule(db: SQLiteDatabase): Promise<NotificationSchedule> {
  const row = await db.getFirstAsync<RawRow>(
    'SELECT * FROM notification_schedule WHERE id = ?',
    SINGLETON_ID
  );
  if (row) return parseRow(row);

  await db.runAsync(
    `INSERT INTO notification_schedule (id, times, mode, activeTopic, selectionOrder, lastSentIndex, translation, notificationContent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    SINGLETON_ID,
    JSON.stringify(DEFAULT_SCHEDULE.times),
    DEFAULT_SCHEDULE.mode,
    DEFAULT_SCHEDULE.activeTopic,
    DEFAULT_SCHEDULE.selectionOrder,
    DEFAULT_SCHEDULE.lastSentIndex,
    DEFAULT_SCHEDULE.translation,
    DEFAULT_SCHEDULE.notificationContent,
  );
  return { ...DEFAULT_SCHEDULE };
}

export async function updateSchedule(
  db: SQLiteDatabase,
  fields: Partial<Omit<NotificationSchedule, 'id'>>
): Promise<void> {
  const serialized = fields.times !== undefined
    ? { ...fields, times: JSON.stringify(fields.times) }
    : fields;
  const entries = Object.entries(serialized);
  const setClauses = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => value) as (string | number | null)[];
  await db.runAsync(
    `UPDATE notification_schedule SET ${setClauses} WHERE id = ?`,
    ...values,
    SINGLETON_ID
  );
}
