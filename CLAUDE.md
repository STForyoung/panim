# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

Panim is a React Native mobile app for meditating on scripture. Users create personal Bible passage snippets with reflections, organize them by topic, and receive them as scheduled push notifications throughout the day.

## Commands

```bash
npm install          # Install dependencies
npx expo start       # Start dev server
npm run ios          # Run on iOS simulator
npm run android      # Run on Android emulator
npm run lint         # Run ESLint
```

## Stack

- **Expo + React Native** with TypeScript (strict mode)
- **Expo Router** — file-based routing, routes live in `app/`
- **expo-sqlite** — local storage for all data
- **expo-notifications** — locally scheduled push notifications

## Architecture

Routing is file-based via Expo Router. The `app/` directory defines screens and navigation. Path alias `@/*` maps to the repo root.

### File Structure

```
app/                  # Screens (one file per route)
src/
  components/         # Reusable UI components
  db/                 # SQLite setup and queries
  notifications/      # Scheduling logic
```

### Data Model

```typescript
Snippet {
  id: string              // UUID
  book: string            // Standardized full name: "1 Corinthians"
  chapterStart: number    // 3
  verseStart: number      // 5
  chapterEnd: number | null   // null if same chapter as start
  verseEnd: number | null     // null if single verse
  passage: string         // Fetched from Bible API, cached locally
  reflection: string      // User's personal thoughts
  createdAt: number       // Unix timestamp
  updatedAt: number       // Unix timestamp
}

Topic {
  id: string
  name: string            // "The Power of God" or "Genesis 1"
  type: "conceptual" | "directed"
  createdAt: number
}

SnippetTopic {            // Junction table — many-to-many
  snippetId: string
  topicId: string
}

NotificationSchedule {
  id: string
  times: string[]                      // ["07:00", "12:00", "20:00"]
  mode: "random" | "topic"             // pool to draw from
  activeTopic: string | null           // topicId, used when mode is "topic"
  selectionOrder: "random" | "sequential"  // how to pick within pool
  lastSentIndex: number                // used when selectionOrder is "sequential"
}
```

## Delete Behavior

- Snippets: permanently deleted with confirmation prompt
- Topics: permanently deleted with confirmation prompt
- Deleting a topic does not delete its snippets — they become unorganized
- Warn user before deleting a topic that contains snippets
- ON DELETE CASCADE handles snippet_topics cleanup automatically

### Reference Display Logic

Derive the display reference from structured fields:

- Single verse: `${book} ${chapterStart}:${verseStart}`
- Same chapter range: `${book} ${chapterStart}:${verseStart}-${verseEnd}`
- Cross-chapter range: `${book} ${chapterStart}:${verseStart}-${chapterEnd}:${verseEnd}`

### Screens

1. Home / Snippet List
2. Create / Edit Snippet
3. Snippet Detail
4. Topic List
5. Topic Detail (snippets within a topic)
6. Settings (notification times, mode, active topic)
7. Onboarding (first launch only)

## Bible API

- Provider: bible-api.com (free, no auth required)
- Base URL: `https://bible-api.com/`
- Example: `https://bible-api.com/1+corinthians+3:5-10`
- Passage is fetched once on snippet creation and cached in SQLite
- App must work offline after initial fetch — never re-fetch if passage already exists
- Book names must be standardized full names (e.g. "1 Corinthians" not "1 Cor")
- If the API call fails, prompt the user to retry — do not save the snippet without a passage

## Notifications

- Scheduling is handled entirely on-device via expo-notifications — no backend needed
- Reschedule notifications whenever: settings change, a new snippet is added to the active topic, or the active topic changes
- If mode is "topic" but the active topic has no snippets, fall back to "random"
- Notification body shows the display reference + first sentence of the passage
- Tapping a notification opens the app to that snippet's detail screen

## Validation

- Book name must be a standardized full Bible book name
- chapterStart, verseStart are required
- chapterEnd and verseEnd are optional but must both be present if a range is intended
- verseEnd must be greater than verseStart if chapterEnd equals chapterStart
- Reflection is required — snippets cannot be saved without a personal reflection
- Each snippet must be assigned to at least one topic before saving

## MVP Rules

- **No backend** — everything runs on device, no server, no auth, no cloud sync
- **No web target** — iOS and Android only
- **Keep changes minimal** — don't touch what doesn't need changing
- **No temporary fixes** — find root causes
- **Only touch what's necessary** — no side effects, no introducing new issues while fixing old ones
- After every change ensure `npx expo start` runs without TypeScript errors

## Out of Scope for MVP

- User accounts or cross-device sync
- Cloud backup
- Sharing snippets
- Per-slot or per-day topic assignment for notifications
- Topic editing or merging
- Streaks or gamification
- Social features

## Lessons

_(Add entries here any time Claude makes a mistake so it doesn't repeat)_
