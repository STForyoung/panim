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

### Provider

- **Current (MVP):** Bolls.life (free, no API key required)
- **Planned migration path:** API.Bible (American Bible Society) → self-hosted/licensed text at scale

### Supported Translations

| Code | Full Name                   |
| ---- | --------------------------- |
| NKJV | New King James Version      |
| NIV  | New International Version   |
| ESV  | English Standard Version    |
| NASB | New American Standard Bible |
| NLT  | New Living Translation      |
| KJV  | King James Version          |

- Default translation: NKJV
- Translation is a global user preference stored in `notification_schedule`

### Architecture

- The Bible API is always accessed through `src/services/bibleService.ts` — never called directly from screens or components
- This abstraction means the underlying provider can be swapped without touching any other file
- Passage is fetched **once** at snippet creation time and cached permanently in SQLite
- Never re-fetch a passage that already exists in the database
- App must be fully functional offline after the initial fetch

### API Details (Bolls.life)

- Base URL: `https://bolls.life`
- Books are referenced by number (e.g. Genesis = 1, John = 43)
- Verses are fetched individually and joined into a passage string
- Use the POST `/get-verses/` endpoint for fetching verse ranges

### Error Handling

- If the API call fails on snippet creation, prompt the user to retry
- Do not save a snippet without a successfully fetched passage
- Show a clear error message — do not fail silently

### Translation Change Behavior (MVP)

- Changing translation applies to new snippets only
- Existing cached passages are not re-fetched when translation changes
- Post-MVP: offer user the option to re-fetch all passages in the new translation

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

- Bolls.life /get-verses/ may return verse objects with undefined text
  for non-existent verse numbers rather than omitting them entirely —
  always guard against undefined before calling string methods on verse text
- Bolls.life /get-verses/ returns an array of arrays (one per request
  object) not a flat array — always call .flat() after parsing the
  JSON response

_(Add entries here any time Claude makes a mistake so it doesn't repeat)_
