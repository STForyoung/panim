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

Routing is file-based via Expo Router using a tab-based layout.

### File Structure

```
app/
  (tabs)/
    index.tsx              # Home — current/next snippet in rotation
    library.tsx            # Library overview — 3 entry points
    settings.tsx           # Translation preference + notification schedule
  topic-kind/
    conceptual.tsx         # All conceptual topics list
    directed.tsx           # All directed topics list
    unassigned.tsx         # Snippets with no topic assigned
  snippet/
    create.tsx             # Create new snippet
    [id].tsx               # Snippet detail (read-only)
    edit/
      [id].tsx             # Edit existing snippet
  topic/
    [id].tsx               # Individual topic detail
  onboarding.tsx           # First-launch onboarding flow
  index.tsx                # Redirects to /(tabs)
  _layout.tsx              # Root layout with SQLiteProvider + AppInitializer
src/
  components/              # Reusable UI components
  db/                      # SQLite setup and queries
  services/
    bibleService.ts        # Bible API service layer
  notifications/
    scheduler.ts           # Local notification scheduling logic
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
  isFavourite: boolean
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
  translation: "NKJV" | "NIV" | "ESV" | "NASB" | "NLT" | "KJV"
}
```

### Reference Display Logic

Derive the display reference from structured fields:

- Single verse: `${book} ${chapterStart}:${verseStart}`
- Same chapter range: `${book} ${chapterStart}:${verseStart}-${verseEnd}`
- Cross-chapter range: `${book} ${chapterStart}:${verseStart}-${chapterEnd}:${verseEnd}`

### Navigation Structure

**Tab 1 — Home**
A welcoming, contemplative screen. Shows the current/next snippet in the notification rotation. One snippet at a time, not a list.

**Tab 2 — Library**
Overview screen with three entry points:

- Conceptual Topics → app/topic-kind/conceptual.tsx
- Directed Topics → app/topic-kind/directed.tsx
- Unassigned Snippets → app/topic-kind/unassigned.tsx

**Topic Kind screens** show a list of topics of that kind, each showing name and snippet count. Tapping a topic navigates to its detail screen.

**Topic Detail** (app/topic/[id].tsx) shows all snippets belonging to that topic. Each snippet shows reference, truncated passage, truncated reflection.

**Unassigned** (app/topic-kind/unassigned.tsx) shows all snippets not belonging to any topic. Same snippet item format as Topic Detail.

**Tab 3 — Settings**
Translation preference and notification schedule configuration.

**Outside tabs:**

- Snippet create and detail are full-screen routes
- Topic detail is a full-screen route

### Screen & Build Order

1. ✅ Tab navigation setup
2. ✅ Topic List + Create Topic (Library tab — now being restructured)
3. ✅ Create Snippet with topic assignment
4. ✅ Library overview screen (3 entry points)
5. ✅ Conceptual Topics screen
6. ✅ Directed Topics screen
7. ✅ Unassigned Snippets screen
8. ✅ Snippet Detail
9. ✅ Snippet Edit
10. ✅ Topic Detail
11. ✅ Add isFavourite to data model
12. ✅ Settings
13. ✅ Home tab
14. ✅ Onboarding
15. ✅ Notification scheduling

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
- Verses are fetched individually and joined into a single passage string
- Use the POST `/get-verses/` endpoint for fetching verse ranges
- Response is an array of arrays — always call `.flat()` after parsing JSON

### Error Handling

- If the API call fails on snippet creation, prompt the user to retry
- Do not save a snippet without a successfully fetched passage
- Show a clear error message — do not fail silently

### Translation Change Behavior (MVP)

- Changing translation applies to new snippets only
- Existing cached passages are not re-fetched when translation changes
- Post-MVP: offer user the option to re-fetch all passages in the new translation

## Create Snippet Flow

1. Book picker — grouped modal (Old Testament / New Testament)
2. Chapter + verse inputs (start required, end optional)
3. Fetch Passage button — calls bibleService.ts, displays result
4. Passage display — read-only
5. Reflection input — required
6. Topic assignment:
   - List of currently assigned topics (each removable)
   - Dropdown to assign an existing topic from the database
   - Auto-suggested directed topic based on book + chapter (e.g. "Genesis 1") — one tap to add
   - Inline create new topic (name + type) — immediately assigned on creation
   - Topic assignment is optional — snippets saved without a topic appear in Unassigned Snippets
7. Save — validates all fields, calls createSnippet + addSnippetToTopic, navigates to Library

## UI Conventions

### Book Selection

- Grouped picker modal: Old Testament (Genesis → Malachi), New Testament (Matthew → Revelation)
- No search filter for MVP — browse only
- Book list derived from BOOK_IDS in bibleService.ts — never duplicated elsewhere

### Topic Assignment (Create Snippet)

- Auto-suggest directed topic from book + chapter as soon as both are entered
- User can accept suggested topic with one tap
- User can assign multiple topics per snippet
- User can create a new topic inline without leaving the screen

### Topic Creation

- Topics are created in two places only:
  1. Inline during Create Snippet — handles both types, immediately assigned
  2. Via "New Topic" button on the Conceptual Topics and Directed Topics
     screens — type is pre-determined by which screen you're on
- No standalone Create Topic screen
- Never create a topic without context — it should always be clear
  what type is being created

### General

- All screens are built — styling pass is next
- Use React Native core components only (View, Text, TextInput, TouchableOpacity, FlatList, Modal, ScrollView)
- No third party UI libraries for MVP

## Delete Behavior

- Snippets: permanently deleted with confirmation prompt
- Topics: permanently deleted with confirmation prompt
- Deleting a topic does not delete its snippets — they become unorganized
- Warn user before deleting a topic that contains snippets
- ON DELETE CASCADE handles snippet_topics cleanup automatically

## Notifications

- Scheduling handled entirely on-device via expo-notifications — no backend needed
- Reschedule notifications whenever: settings change, new snippet added to active topic, active topic changes
- If mode is "topic" but active topic has no snippets, fall back to "random"
- Notification body shows display reference + first sentence of passage
- Tapping a notification opens the app to that snippet's detail screen

## Validation

- Book name must be a standardized full Bible book name from BOOK_IDS
- chapterStart and verseStart are required
- chapterEnd and verseEnd are optional but must both be present if a range is intended
- verseEnd must be greater than verseStart if chapterEnd equals chapterStart
- Reflection is required
- Topic assignment is optional — unassigned snippets appear in the Unassigned Snippets screen

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
- AMP translation
- Search filter in book picker
- Re-fetching passages when translation changes

## Design Tokens

All colors, typography, spacing, radius, and shadow values live in `src/constants/theme.ts`.

- Never hardcode colors, font sizes, or spacing values in screen files — always import from `theme.ts`
- Scripture and reflection text always uses the Lora font family
- UI labels, buttons, and navigation always use the system font (no `fontFamily` set)

## Utilities

- `src/utils/displayReference.ts` — `getDisplayReference(snippet)` derives the display reference string from structured fields per Reference Display Logic. Use this everywhere a reference is displayed — never derive inline.

## Lessons

- newArchEnabled in app.json — if useSQLiteContext throws "Property doesn't exist",
  try restarting the dev server with --clear before assuming a version or config issue
- Bolls.life /get-verses/ may return verse objects with undefined text for non-existent
  verse numbers — always guard against undefined before calling string methods on verse text
- Bolls.life /get-verses/ returns an array of arrays (one per request object) not a flat
  array — always call .flat() after parsing the JSON response
- SQLite does not return booleans — boolean fields come back as
  0 or 1 integers. Always cast with !! when using in UI conditions
  e.g. !!snippet.isFavourite instead of snippet.isFavourite === true
- expo-notifications remote notifications are removed from Expo Go
  in SDK 53+. Local notifications still work on iOS Expo Go.
  For full Android notification testing create a development build
  via: eas build --profile development --platform android
- useSQLiteContext cannot be called in \_layout.tsx directly since
  it is the component that renders SQLiteProvider. Extract any
  logic that needs DB access into a child component rendered
  inside SQLiteProvider (e.g. AppInitializer)
