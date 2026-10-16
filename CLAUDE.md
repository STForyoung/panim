# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

It has two parts: **Where we are** (how the app works today and the rules to follow) and **Where we're going** (roadmap, the future backend, known gaps).

---

# Part 1 — Where we are

## About

Panim is a React Native mobile app for meditating on scripture. Users read the Bible in the app, tap the verses that speak to them, and write a reflection (and optionally a prayer). Each saved passage-plus-reflection is a **snippet**. Snippets are organised by topic and come back throughout the day as scheduled local notifications.

Status: the MVP is feature-complete and not yet released. Much of the recent work has been type-checked and viewed in the iOS simulator but not exercised by hand on real devices (see Roadmap).

## Commands

```bash
npm install                      # Install dependencies
npx expo start                   # Start dev server (development-build mode, because expo-dev-client is installed)
npx expo start --go              # Start for Expo Go
npx expo start --go --tunnel     # Expo Go when the phone is not on the same network
npx expo start --clear           # Reset the Metro cache
npx tsc --noEmit                 # Type-check
npm run lint                     # ESLint
npm run ios / npm run android    # Native build and run (android/ and ios/ are generated and gitignored)
```

- **Node:** 22.13+ or 24.3+ is required by React Native 0.86. Node 20.14 fails. With nvm: `nvm use 24`.
- **Expo Go:** the App Store only ships Expo Go for the newest SDK, so a real iPhone needs Expo Go for SDK 57. The iOS simulator gets a matching Expo Go installed by the CLI.
- **Android notifications:** not fully testable in Expo Go. Use a development build: `eas build --profile development --platform android`.

## Stack

- **Expo SDK 57 + React Native 0.86**, TypeScript 6 (strict)
- **Expo Router** — file-based routing, routes live in `app/`
- **expo-sqlite** — all user data
- **expo-notifications** — locally scheduled reminders
- **AsyncStorage** — small device-only values: `hasLaunched` (onboarding done), `lastRead` (Bible position), `removedTranslations`
- **Fonts** — Merriweather (the app's only serif) and Noto Rashi Hebrew (the onboarding wordmark), via `@expo-google-fonts`
- **Icons** — Ionicons from `@expo/vector-icons`

## File Structure

```
app/
  _layout.tsx              # Root: fonts, SQLiteProvider, AppInitializer (device id, reminder top-up)
  index.tsx                # Redirects to onboarding or /(tabs)
  onboarding.tsx           # 5 steps: brand, how it works, notifications, rhythm, all set
  (tabs)/
    _layout.tsx            # Tabs: Home, Bible, Library, Settings
    index.tsx              # Home
    bible.tsx              # Bible reader
    library.tsx            # Library overview
    settings.tsx           # Translation + reminders
  snippet/
    create.tsx             # New snippet
    [id].tsx               # Snippet detail (read-only)
    edit/[id].tsx          # Edit snippet
  topic/[id].tsx           # Topic detail
  topic-kind/
    custom.tsx             # "My Topics"
    book.tsx               # "Bible Books"
    unassigned.tsx         # Snippets with no custom topic
assets/
  bible/kjv/               # Bundled King James Version, one JSON file per book (1.json … 66.json)
src/
  components/
    BookPicker.tsx         # Sheet: Old/New Testament switch, book list, optional chapter grid
    Button.tsx             # Text button: primary | tonal | ghost | danger, optional icon
    Fab.tsx                # Floating "+" button
    FadeIn.tsx             # Fade-and-rise on mount
    IconButton.tsx         # Round icon button; `filled` for a primary action
    Icons.tsx              # Chevron, SelectedCheck
    ListRow.tsx            # Navigation row: icon, title, subtitle, chevron
    PassageText.tsx        # Verses with verse numbers; `large` for reading screens
    PressableScale.tsx     # Press feedback (shrink + fade); `dim={false}` to skip the fade
    ScreenHeader.tsx       # Back button + right-side actions
    SnippetCard.tsx        # Snippet summary card for lists
    StateViews.tsx         # LoadingState, EmptyState
    TabBar.tsx             # Custom tab bar
    TopicChip.tsx          # Topic pill, optionally removable
    TopicNameSheet.tsx     # Sheet with one field, for creating and renaming a topic
  constants/theme.ts       # All design tokens
  db/                      # SQLite setup, migrations, queries, seeds
  notifications/scheduler.ts   # Reminder playlist and scheduling
  services/
    bibleService.ts        # The only place Bible text is fetched
    offlineBible.ts        # Loader for the bundled KJV
    passageDraft.ts        # Hands a passage from the Bible tab to the create screen
  utils/
    displayReference.ts    # getDisplayReference(snippet)
    superscript.ts         # toSuperscript(n) for inline verse numbers
```

## Data Model

```typescript
Snippet {
  id: string                  // UUID
  book: string                // Standardized full name: "1 Corinthians"
  chapterStart: number
  verseStart: number
  chapterEnd: number | null   // null if same chapter as start
  verseEnd: number | null     // null if single verse
  passage: PassageVerse[]     // [{ chapter, verse, text }], stored as JSON; cached permanently
  reflection: string
  prayer: string | null
  translation: string         // Version the passage text is in, e.g. "KJV"
  isFavourite: boolean        // Stored as 0/1
  createdAt: number           // Unix ms
  updatedAt: number
  // syncedAt column exists in the table, unused until a backend exists
}

Topic {
  id: string
  name: string                // "Beholding the face of God" or "Psalms"
  type: "custom" | "book"     // custom = user-made; book = one per Bible book, seeded, not deletable
  createdAt: number
}

SnippetTopic { snippetId, topicId }   // Many-to-many; ON DELETE CASCADE both ways

NotificationSchedule {               // Single row, id "singleton"
  times: string[]                              // ["09:00", "12:00", "18:00"]
  mode: "random" | "topic" | "favourites"      // Which snippets reminders draw from ("random" = all)
  activeTopic: string | null                   // topicId when mode is "topic"
  selectionOrder: "random" | "sequential"      // Shuffled, or oldest first
  notificationContent: "passage" | "reflection" | "prayer"
  translation: "KJV" | "BSB" | "NKJV" | "ESV" | "NASB" | "NLT"   // Global preference; also lives here
  lastSentIndex: number                        // Unused leftover
}

metadata (key/value)
  deviceId            // Stable id for future sync
  starterContent      // Set once starter content has been handled for this install
  reminderPlaylist    // Device-only: order reminders work through
  reminderQueue       // Device-only: dated notifications currently scheduled
```

- Every snippet is automatically linked to its **book topic** on save. "Unassigned" therefore means "has no custom topic".
- **Migrations** live in `src/db/database.ts` and are versioned with `PRAGMA user_version` (currently **2**). Add the next one as `if (currentVersion < 3) { … PRAGMA user_version = 3 }`. See Lessons for the Android rules.
- On first run, 66 book topics and the starter content in `src/db/seeds.ts` are seeded: two custom topics ("This is the Gospel", "Meditating on The Word") with their snippets in KJV text. Starter content is added once per install (marked by `metadata.starterContent`) and only if the install has no snippets
- **Built-in content has fixed ids, the same on every device:** `book:<n>` for book topics (`book:19` is Psalms), `starter-topic:<slug>` and `starter:<book>-<chapter>-<verse>` for starter content. This lets two devices merge under one account later without duplicates. Never change these ids once released. Installs from before this change keep random ids for their built-in content, so always look book topics up by type and name, not by id

### Reference Display Logic

Always use `getDisplayReference(snippet)` from `src/utils/displayReference.ts` — never build the string inline.

- Single verse: `John 3:16`
- Same-chapter range: `Psalms 23:1-6`
- Cross-chapter range: `Romans 8:1-8:39`

## Screens

**Home** — greeting with a time-of-day icon and the next reminder time (or, when times are set but notification permission is off, a line saying so; tapping it shows the system prompt, or opens the phone's settings for the app if permission was already declined). The main card is the snippet the next reminder will send: passage (4 lines, inline verse numbers), reference with a quiet version tag, topic chips, and the reflection in a tinted box. "Coming up" shows the three after it; "Favourites" is a second carousel. Floating "+" creates a snippet.

**Bible** — chapter reader. Tap the chapter title for the BookPicker; arrows move between chapters and across books. Tap a verse to select it, tap further verses to extend or trim a continuous range, then "Add reflection" opens New Snippet with the passage filled in. Remembers the last chapter read. It can also be opened at a passage with route params (`/bible?book=John&chapter=3&verseStart=16&verseEnd=17&at=<timestamp>`): the chapter opens scrolled to those verses, which are lightly tinted. `at` must change on each request so a repeat is noticed.

**Library** — three rows: My Topics, Bible Books, Unassigned Snippets. Floating "+".

**My Topics / Bible Books** — lists with snippet counts. My Topics has a header "+" for a new topic and long-press to delete.

**Topic detail** — name, kind and count, then snippet cards. Header "+" creates a snippet in that topic; custom topics also have header icons to rename and delete. Book topics can be neither renamed nor deleted.

**Snippet detail** — header icons for favourite, edit and delete. Reference as the title, full version name beneath it, topic chips, the passage with a "Read in context" link that opens the Bible tab at it, then Reflection and Prayer cards.

**New / Edit Snippet** — fixed top bar with back, title and a save tick (there is also a save button at the bottom). The passage shows as a card with a "Change" link; the reference fields (book, chapter, verse, optional end chapter and verse, fetch button) appear only when there is no passage yet or after "Change". Then Reflection, Prayer (optional) and Topics.

**Settings** — Select Translation, then Reminders: a notice with a "Turn on" / "Open Settings" action when notification permission is off, Times per day (segmented presets), Your times (grid with add and remove), Which snippets to send, What each reminder shows, Order. At the bottom, a "Scripture versions" row opens a sheet crediting each version. Translation saves immediately; reminder changes are held until "Apply".

**Onboarding** — shown until `hasLaunched` is set.

## Bible Text

### Rules

- Bible text is always obtained through `src/services/bibleService.ts` — never fetched from screens or components
- A snippet's passage is stored with the snippet and **never re-fetched** to display it. Snippets, lists, Home and reminders make no network calls
- Do not save a snippet without passage text
- Each snippet records the `translation` its text is in; show it wherever a passage is the focus (quietly — `typography.translationTag`)
- Changing the translation setting affects new fetches only; existing snippets keep their text and version

### Translations

| Code | Name                        | Availability                                   |
| ---- | --------------------------- | ---------------------------------------------- |
| KJV  | King James Version          | Bundled, public domain — works offline. Default |
| BSB  | Berean Standard Bible       | Bundled, public domain — works offline         |
| NKJV | New King James Version      | Online only (copyrighted)                      |
| ESV  | English Standard Version    | Online only (copyrighted)                      |
| NASB | New American Standard Bible | Online only (copyrighted)                      |
| NLT  | New Living Translation      | Online only (copyrighted)                      |

- Settings lists them in this order: bundled first, then online. The list lives in `src/db/notificationSchedule.ts` and `app/(tabs)/settings.tsx`
- Bundled text is in `assets/bible/kjv` and `assets/bible/bsb`, loaded through `src/services/offlineBible.ts`. The BSB leaves out 16 later-manuscript verses (for example Acts 8:37); they are stored empty and skipped
- **NIV is not offered** — the provider serves a publisher notice in its place
- `TRANSLATION_CREDITS` in `bibleService.ts` holds each version's ownership line for the credits sheet. The lines state who owns the text and nothing more: never add "Used by permission" unless a licence is actually in place
- `TRANSLATION_NAMES` and `getTranslationAvailability()` in `bibleService.ts` are the source for names and the labels shown in Settings ("Online only", "Not currently available"; bundled translations show no label)

### When an online translation is withdrawn

The online translations come from a free service with no agreement, so any of them can disappear, as NIV did. The app is built to survive that without a release:

- The first time an online translation is used in a session, `bibleService` asks for two known verses. A withdrawn translation comes back empty or with the same notice for every verse; either marks it **removed**. Being offline is never treated as removal
- Removed translations are remembered on the device (AsyncStorage `removedTranslations`, loaded at launch by `loadTranslationStatus()`), re-checked when Settings opens, and offered again if they return
- **Settings** greys the translation out, labels it "Not currently available", and it cannot be chosen
- **Bible tab** shows KJV with a note saying the translation is no longer available and to choose another in Settings
- **Typed references** show a clear error and save nothing. Text is only accepted from a translation confirmed to be served, so a notice can never be stored as a passage
- **Existing snippets** in that translation are unaffected: they keep their stored text and label

### Online provider (Bolls.life)

- Free, no API key, no agreement. Base URL `https://bolls.life`. Books are referenced by number (Genesis = 1, John = 43)
- It rejects bursts of requests (HTTP 429) — make calls one at a time, never in a parallel batch
- Verse ranges: POST `/get-verses/` — the response is an array of arrays, always `.flat()` it
- Whole chapters: GET `/get-text/<translation>/<bookId>/<chapter>/`
- All provider text goes through `stripHtml`, which removes markup, Strong's numbers and footnotes

### Offline behaviour

- KJV and BSB need no connection anywhere in the app
- **Bible tab, online translation:** if it cannot be fetched (offline, or no response in 10 seconds) it shows KJV with a note and a Retry link, and tries again on the next visit. Online chapters are kept in memory for the session only
- **Typed references, online translation:** show a connection error with a retry — they never silently substitute another translation
- A reflection added while the Bible tab is showing the KJV fallback saves KJV text and records KJV

## Creating a Snippet

Two entry points:

1. **From the Bible tab** — selected verses are passed through `passageDraft` (route param `fromReader=1`); the form opens with the passage card already filled, nothing to fetch.
2. **Typed reference** — pick a book (BookPicker), enter chapter and verse, optionally an end chapter and verse, then Fetch Passage.

Topics on the form: assigned topics as removable chips, "Existing topic" (sheet of custom topics) and "New topic" (inline name field; created on save). Topic assignment is optional. Saving also links the snippet to its book topic, reschedules reminders, and opens the new snippet's detail screen.

Topics are created in two places only: inline on the snippet form, and the "+" on My Topics. Both create `custom` topics. Book topics are never created by users.

## Reminders

- Scheduling is entirely on-device via expo-notifications
- Reminders work through a saved playlist of snippet ids for the current selection (mode + topic + order), stored in `metadata.reminderPlaylist`; the notifications currently scheduled are in `metadata.reminderQueue`
- No app code runs when a notification fires, so the playlist is scheduled ahead as individual dated notifications: up to 60 (iOS allows 64 pending) and at most 14 days. The last one is a notice to open the app and refresh reminders
- `scheduleNotifications(db)` in `src/notifications/scheduler.ts` syncs the playlist and tops up the queue. It is cheap to call (it does nothing unless something changed or a reminder has fired). Call it on launch, on returning to the foreground, when Home gains focus, and after any change to settings, snippets, favourites or topics
- Order "random" = shuffled, no repeats until every snippet has been sent, reshuffled each pass; "sequential" = oldest first. New snippets join the current pass
- Home's main card and "Coming up" come from `getUpcomingReminders(db, n)` — never pick independently
- If mode is "topic" but the topic has no snippets, or "favourites" with none, fall back to all snippets
- Notification title is the reference; the body is the first sentence of the passage, reflection or prayer (prayer falls back to reflection, then passage)
- Tapping a notification opens that snippet's detail screen, including when the tap launches a closed app. This is handled in `AppInitializer` with `useLastNotificationResponse()` once the app has reached the tabs, then `clearLastNotificationResponseAsync()`. Do not switch back to `addNotificationResponseReceivedListener`: it is registered too late to catch a launching tap

## Design System

All colors, typography, spacing, radius, layout sizes and shadows live in `src/constants/theme.ts`. **Never hardcode colors, font sizes or spacing in screens or components** — add a token if one is missing.

- **Palette** — warm off-white `background`, lighter `surface` for cards, charcoal text (`textHeading`, `textPrimary`, `textSoft`, `textSecondary`), one teal-green `accent` with `accentSoft` (chips, icon backgrounds) and `accentTint` (pale tinted areas), `onAccent` for text on the accent, `border`, `danger`
- **Fonts** — `fonts.serif*` is Merriweather: Light for reading text, SemiBold and Bold for references and titles. Everything else uses the system font (no `fontFamily`)
  - Serif: scripture, reflections and prayers where they are read or written in full, screen titles, section titles, references
  - System font: buttons, labels, settings, navigation, and the reflection preview on the Home card
- **Type roles** — `display` (screen titles), `heading`, `title`, `scriptureHero` (Home card passage), `scriptureLarge` (snippet screen, Bible tab), `scripture` (list cards, form preview), `reflection` / `reflectionMedium` / `reflectionLarge`, `reference`, `translationTag`, `body` / `bodySmall` / `bodyLarge`, `label`, `caption`, `button`
- **Cards are flat** — no shadows and no borders; contrast comes from `surface` on `background`. Only floating elements use `shadows.floating`. Text fields show an accent border while focused; fields that sit inside a card are tinted with `background`
- **Radius** — `radius.sm/md/lg` are a deliberate choice by the owner; do not change them
- **Scripture is upright, not italic.** Italic is used only on the onboarding brand screen

## UI Conventions

- React Native core components only (including `Pressable`, `Animated`, `ActivityIndicator`, `Modal`); no third-party UI libraries
- Reuse the shared components in `src/components/` before writing new markup: buttons, icon buttons, headers, list rows, loading and empty states, press feedback, the book picker
- Icons come from Ionicons — never use text characters such as `›`, `✓`, `×`, `+` or `★` as icons
- Pickers open as sheets: `presentationStyle="pageSheet"` with `onRequestClose`
- Labels and headings are sentence case; no all-caps section labels
- Destructive actions are quiet (a muted header icon or small link) and always confirm
- The book list always comes from `CANONICAL_BOOKS` / `BOOK_IDS` in `bibleService.ts` — never duplicate it
- No search filter in the book picker — browse only

## Validation

- Book must be a standardized full name from `BOOK_IDS`
- `chapterStart` and `verseStart` are required
- An end chapter requires an end verse
- A passage must be present before saving
- Topic assignment is optional
- Reflection is deliberately **not** required: saving must never be blocked at the moment someone finds a verse. It is encouraged instead — the form labels it "Reflection" with no "(optional)" (Prayer is marked optional), and a snippet without one shows an "Add a reflection" prompt on its detail screen

## Delete Behavior

- Snippets and topics are permanently deleted, after a confirmation prompt
- Deleting a topic from My Topics (long-press) keeps its snippets; they simply lose that topic
- Deleting from topic detail offers "Delete Topic Only" or "Delete Topic & Snippets" when the topic has snippets
- Book topics cannot be deleted
- `ON DELETE CASCADE` cleans up `snippet_topics`

## Website (panim.io)

- Plain static pages in `website/public` (home, `/privacy`, `/support`), styled to match the app. No build step
- Deployed by Cloudflare (Workers with static assets) from the `website` folder on every push to `main`; config in `website/wrangler.jsonc`
- `https://panim.io/privacy` and `https://panim.io/support` are the URLs given to the App Store and Play Store. Keep the privacy policy in step with what the app actually sends: today only Bolls.life (online-only Bible versions) and Expo's update service. Update its effective date when it changes
- Contact address is `hello@panim.io`, forwarded by Cloudflare Email Routing

## Working Rules

- **No backend** — everything runs on device: no server, no auth, no cloud sync (see Future backend for the direction)
- **No web target** — iOS and Android only
- **Keep changes minimal** — don't touch what doesn't need changing
- **No temporary fixes** — find root causes
- **Only touch what's necessary** — no side effects, no new issues while fixing old ones
- After every change, `npx tsc --noEmit` and `npm run lint` must pass

## Lessons

- newArchEnabled in app.json — if useSQLiteContext throws "Property doesn't exist",
  try restarting the dev server with --clear before assuming a version or config issue
- Bolls.life /get-verses/ may return verse objects with undefined text for non-existent
  verse numbers — always guard against undefined before calling string methods on verse text
- Bolls.life /get-verses/ returns an array of arrays (one per request object) not a flat
  array — always call .flat() after parsing the JSON response
- Bolls.life text is not clean: KJV carries Strong's numbers (`<S>1245</S>`) and footnotes
  (`<sup>…</sup>`), NLT uses `<br>` between poetry lines, and NIV returns a publisher notice
  instead of scripture. Check a real response before trusting a translation
- SQLite does not return booleans — boolean fields come back as
  0 or 1 integers. Always cast with !! when using in UI conditions
  e.g. !!snippet.isFavourite instead of snippet.isFavourite === true
- expo-notifications remote notifications are removed from Expo Go
  in SDK 53+. Local notifications still work on iOS Expo Go.
  For full Android notification testing create a development build
  via: eas build --profile development --platform android
- A tap on a notification that launches a closed app is delivered before the root layout finishes
  loading (fonts, database), so a response listener registered there misses it and the app opens on
  Home. Read it with `useLastNotificationResponse()` instead, and only navigate once the start-up
  redirect has landed on the tabs, or the redirect overrides the navigation
- A local notification cannot run app code when it fires. Anything that must vary per
  reminder has to be decided when it is scheduled
- useSQLiteContext cannot be called in \_layout.tsx directly since
  it is the component that renders SQLiteProvider. Extract any
  logic that needs DB access into a child component rendered
  inside SQLiteProvider (e.g. AppInitializer)
- Do not batch PRAGMA statements with DDL in a single execAsync call in migrateDb —
  combining PRAGMA journal_mode = WAL with CREATE TABLE statements causes
  "database is locked" on Android. Run each PRAGMA in its own execAsync call
  before the DDL block.
- Do not use getAllAsync or other prepared-statement APIs inside migrateDb (the
  onInit handler) — this causes SQLITE_MISUSE (error code 21) on Android.
  Use only execAsync for migrations; do row-level data transforms with pure SQL
  (e.g. UPDATE ... SET col = json_quote(col) WHERE ...) instead of JS loops.
- Expo Go on a real iPhone only runs the newest SDK. An older project shows
  "Project is incompatible with this version of Expo Go"; the iOS simulator is unaffected
- With expo-dev-client installed, `npx expo start` produces a development-build QR code
  that the phone camera reports as "No usable data found". Use `--go` for Expo Go
- The top-level `splash` field in app.json is no longer accepted; configure the
  `expo-splash-screen` plugin instead
- Fading a parent (opacity) that contains tinted children renders unevenly while pressed.
  Use `dim={false}` on PressableScale for such cards, and build tinted boxes from plain
  solid views rather than one-sided borders with partial corner radii
- The lint rule react-hooks/set-state-in-effect rejects a synchronous setState in an
  effect body. Set state in the event handler that triggers the work, or after an await
- A component that should start fresh each time a modal opens is simplest as an inner
  component rendered only while visible, with its initial state taken from props

---

# Part 2 — Where we're going

## Roadmap

In order:

1. **Test on real devices** — an iPhone and an Android development build. Not yet exercised by hand: verse selection and "Add reflection" in the Bible tab, the reworked New/Edit forms, the pickers, reminder delivery and rotation, the offline KJV fallback, and everything on Android
2. **App icon and splash — done.** The tree logo is in place: `assets/icon.png`, the Android adaptive and monochrome icons, and a splash lockup (tree plus PANIM wordmark, `assets/splash.png`, with `assets/splash-android.png` for Android). These only show in a native build, not in Expo Go — check them on the first development or TestFlight build. The splash background in app.json matches the app's `background` token (`#EEECE6`); keep the two in step if the token changes
3. **Bible licensing — decided for the MVP (2026-10-12):** launch with the four online versions (NKJV, ESV, NASB, NLT) as they are, unlicensed, accepting the risk. Panim is positioned as a meditation and journaling app, not a Bible app. Licensing, or removing a version, is to be handled when the premium version is built or if a publisher objects. Do not re-raise this as a blocker. Note that removing a version at a publisher's request needs an app update (the automatic handling only covers the provider withdrawing it). KJV and BSB are public domain
4. **Dark mode** — `userInterfaceStyle` is already `automatic`; no dark palette exists yet. Colours are all tokens, so this is mainly a second palette plus a way to switch
5. **Premium backend** — see below

## Future Improvements

Ideas discussed and agreed as worth doing after launch. None block the MVP. The first entry is the agreed first post-launch feature; the rest are not scheduled.

- **Meditation mode (first post-launch feature)** — a full-screen view that shows one snippet at a time, moving between them by swiping sideways like turning pages (not a vertical feed, which invites skimming). It is most useful once a user has many snippets. Shape agreed so it stays contemplative:
  - entered deliberately — a "Meditate" button on a topic and on the Home card — while lists stay as they are
  - a defined set with an end (a topic's snippets, or the next few in the reminder playlist) and a quiet closing screen, never an endless supply
  - nothing on screen but the passage and reflection, one way out, and perhaps a way to add a thought to the current snippet
  - React Native's own paging list is enough; no new packages
- **Multi-verse snippets** — one snippet holding separate verses (John 3:16 with 3:18) or verses from different books (John 3:16 with Romans 5:8). Today a snippet is one verse or one continuous range. The passage is already stored as a list of verses, so this mainly needs: the reference built from that list instead of start/end fields (for example "John 3:16, 18" or "John 3:16; Romans 5:8"), tap-to-toggle selection in the Bible tab (and keeping a selection while changing chapter or book, for the multi-book case), a `book` on each stored verse and links to more than one book topic (multi-book only). Existing snippets need no conversion; a range is the simplest case of a verse list
- **"Update available" line in the app** — compare the installed version with the App Store's (Apple's public lookup by bundle id) and offer to open the store. Android needs Google's in-app update package
- **Mark verses that already have snippets** in the Bible tab
- **Show the translation in reminders**
- **A native time picker** for custom reminder times (needs a package)
- **"Remove starter snippets"** in Settings, only if users ask for it
- **More starter content in an update** — change `metadata.starterContent` from "1" (done) to a version number, group `SEED_DATA` into numbered sets (today's two topics are set 1), and on launch add every set newer than the recorded number. Record sets added, not snippets present, so content a user deleted never comes back. Can ship over the air. Decide then: whether new content joins reminders straight away (a new topic is gentlest), whether to fill passages from the user's bundled version (KJV or BSB) instead of fixed KJV text, and whether users who deleted all starter content still get new sets
- **Android back gesture feel** — on Android, back is the system edge swipe (must start at the very edge, shows an arrow, then jumps back), which feels less fluid than the iPhone's drag-from-edge. To revisit: turn on `android.predictiveBackGestureEnabled` in app.json (Android 14+ then previews the previous screen while swiping). Needs a new native build and testing on a phone, since it changes how back events arrive. A custom in-app swipe gesture was ruled out: it would conflict with the system gesture and the horizontal carousels
- **iPad support** — `supportsTablet` is off; turning it on needs the layout checked on iPad and iPad screenshots for the store
- **Occasional encouragements** — preferred route: local notifications with encouragement messages bundled in the app (for example weekly), new messages shipped over the air. Collects nothing. Alternative for a mailing list later: an optional email signup posting to a newsletter service's public form (no own server needed); this changes the App Store privacy answers from "Data Not Collected", must stay optional, needs an unticked opt-in and an updated privacy policy
- **Remote push notifications** (for example to announce an update) — needs push tokens stored on a server, so it belongs with the premium backend

## Future backend (premium)

A premium version is expected to add a remote backend for accounts and cross-device sync. The MVP stays on-device, but new work should not make that harder.

### Principles to follow now

- Keep three kinds of data apart. Only the first would ever sync:
  1. **User-created data** — snippets, reflections, prayers, topics, favourites, settings
  2. **Device-only state** — the reminder playlist and queue (`metadata.reminderPlaylist`, `metadata.reminderQueue`), last-read Bible position (AsyncStorage `lastRead`), withdrawn translations (AsyncStorage `removedTranslations`)
  3. **Disposable copies of Bible text** — chapters of online translations fetched for the Bible tab (in memory only today)
- Every user record keeps a stable UUID and, where it exists, a last-changed time
- Each snippet records its Bible `translation`, so another device can re-fetch the passage from reference + version. The cloud is expected to store references and the user's own words, not a library of Bible text
- All Bible text access stays behind `src/services/bibleService.ts`, so the source can move to a licensed API (API.Bible is the candidate) behind our own server
- Do not persist whole chapters of copyrighted translations on the device without checking the licence terms

### Deliberately deferred until cloud work starts

- Recording deletions (soft delete or a deletions log) for snippets, topics and topic links — deletes are permanent today
- `updatedAt` on topics; timestamps on `snippet_topics`
- Using the existing `snippets.syncedAt` column and `metadata.deviceId`
- A persistent on-device chapter cache (depends on the Bible source and its licence)

## Known Gaps

- **Reminders don't show the translation** — the notification title is the reference only
- **Bible tab** — one chapter at a time (no selection across chapters), and verses that already have snippets are not marked. "Read in context" opens the passage in the currently selected translation, which may differ from the snippet's
- **Settings** — custom times are typed into hour and minute boxes; translation saves instantly while reminder changes wait for "Apply"
- **`migrateDb` uses prepared statements** (`getFirstAsync` / `runAsync`) for the version check and seeding, which the Android lesson above warns against. Verify on Android
- **`updateSnippet` uses dynamic SQL** — builds SET clauses from `Object.entries(fields)`; explicit columns would be safer as the schema grows
- **No pagination** — `getAllSnippets` fetches every row, and several screens look up topics per snippet
- **Starter content is one-time** — `metadata.starterContent` records that it ran; shipping new default content to existing users would need a version number there
- **`notification_schedule` is a single row** — per-slot or per-day targeting would need a redesign, and the translation preference lives there for historical reasons
- **Leftovers** — the `lastSentIndex` column, the `web` and `reset-project` scripts in package.json, and `react-native-web` are unused

## Out of Scope for MVP

- User accounts, cross-device sync and cloud backup (see Future backend)
- Sharing snippets
- Per-slot or per-day topic assignment for reminders
- Merging topics
- Streaks, gamification, social features
- Reading plans, highlights, bookmarks or search in the Bible tab
- Search filter in the book picker
- Re-fetching existing passages when the translation changes
- A background task for reminders (decided against: opening the app refills the queue)
