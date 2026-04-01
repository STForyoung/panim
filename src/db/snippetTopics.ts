import { type SQLiteDatabase } from 'expo-sqlite';
import { type Snippet } from './snippets';
import { type Topic } from './topics';

export async function addSnippetToTopic(
  db: SQLiteDatabase,
  snippetId: string,
  topicId: string
): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO snippet_topics (snippetId, topicId) VALUES (?, ?)',
    snippetId,
    topicId
  );
}

export async function removeSnippetFromTopic(
  db: SQLiteDatabase,
  snippetId: string,
  topicId: string
): Promise<void> {
  await db.runAsync(
    'DELETE FROM snippet_topics WHERE snippetId = ? AND topicId = ?',
    snippetId,
    topicId
  );
}

export async function getTopicsForSnippet(
  db: SQLiteDatabase,
  snippetId: string
): Promise<Topic[]> {
  return db.getAllAsync<Topic>(
    `SELECT t.* FROM topics t
     INNER JOIN snippet_topics st ON st.topicId = t.id
     WHERE st.snippetId = ?
     ORDER BY t.createdAt DESC`,
    snippetId
  );
}

export async function getSnippetsForTopic(
  db: SQLiteDatabase,
  topicId: string
): Promise<Snippet[]> {
  return db.getAllAsync<Snippet>(
    `SELECT s.* FROM snippets s
     INNER JOIN snippet_topics st ON st.snippetId = s.id
     WHERE st.topicId = ?
     ORDER BY s.createdAt DESC`,
    topicId
  );
}
