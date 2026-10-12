import { Button } from "@/src/components/Button";
import { FadeIn } from "@/src/components/FadeIn";
import {
  colors,
  fonts,
  radius,
  spacing,
  typography,
} from "@/src/constants/theme";
import { getSchedule, updateSchedule } from "@/src/db/notificationSchedule";
import { scheduleNotifications } from "@/src/notifications/scheduler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

async function completeOnboarding() {
  await AsyncStorage.setItem("hasLaunched", "true");
}

function ProgressDots({ active }: { active: 1 | 2 | 3 }) {
  return (
    <View style={styles.dotsRow}>
      {([1, 2, 3] as const).map((i) => (
        <View key={i} style={[styles.dot, active === i && styles.dotActive]} />
      ))}
    </View>
  );
}

// Must match PRESETS in settings.tsx exactly so the active chip highlights on first open
const FREQUENCY_OPTIONS = [
  { value: "2", label: "2×", desc: "9 AM · 6 PM", times: ["09:00", "18:00"] },
  {
    value: "3",
    label: "3×",
    desc: "9 AM · 12 PM · 6 PM",
    times: ["09:00", "12:00", "18:00"],
  },
  {
    value: "4",
    label: "4×",
    desc: "9 AM · 12 · 3 PM · 6 PM",
    times: ["09:00", "12:00", "15:00", "18:00"],
  },
  {
    value: "5",
    label: "5×",
    desc: "9 AM · 12 · 3 · 6 · 9 PM",
    times: ["09:00", "12:00", "15:00", "18:00", "21:00"],
  },
];

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const [step, setStep] = useState(1);
  const [frequency, setFrequency] = useState("3");

  async function handleRhythmContinue() {
    const times =
      FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.times ??
      FREQUENCY_OPTIONS[1].times;
    await getSchedule(db); // ensures the row exists before updating
    await updateSchedule(db, { times });
    await scheduleNotifications(db);
    next();
  }

  function next() {
    setStep((s) => s + 1);
  }

  async function handleAllowNotifications() {
    await Notifications.requestPermissionsAsync();
    next();
  }

  async function handleComplete(destination: "create" | "home") {
    await completeOnboarding();
    if (destination === "create") {
      router.replace("/snippet/create");
    } else {
      router.replace("/(tabs)");
    }
  }

  // Step 1 — Brand
  if (step === 1) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <FadeIn key="step1" style={[styles.top, styles.topCentered]}>
            <Text style={styles.hebrew}>פָּנִים</Text>
            <Text style={styles.transliteration}>pā·nîm</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.appName}>PANIM</Text>
            <Text style={styles.partOfSpeech}>[Hebrew noun]</Text>
            <Text style={styles.definition}>
              <Text style={styles.definitionItalic}>
                &ldquo;Face, presence, countenance.&rdquo;
              </Text>{" "}
              — the word used throughout Scripture for the intimate, manifest
              presence of God. May this app help you dwell before His face. Amen
            </Text>
            <View style={styles.verseBlock}>
              <Text style={styles.verseText}>
                Your face, O LORD, I will seek.
              </Text>
              <Text style={styles.verseReference}>Psalm 27:8</Text>
            </View>
          </FadeIn>
          <Button label="Begin" onPress={next} />
        </View>
      </SafeAreaView>
    );
  }

  // Step 2 — How it works
  if (step === 2) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <FadeIn key="step2" style={styles.top}>
            <ProgressDots active={1} />
            <Text style={styles.sectionLabel}>Your meditations</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.heading}>How it works</Text>
            <Text style={styles.body}>
              Create snippets from Bible passages with your reflections.
            </Text>
            <Text style={styles.body}>Organize them by topic.</Text>
            <Text style={styles.body}>
              Receive them as notifications throughout your day as quiet
              reminders to pause and meditate.
            </Text>
          </FadeIn>
          <Button label="Next" onPress={next} />
        </View>
      </SafeAreaView>
    );
  }

  // Step 3 — Notifications
  if (step === 3) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <FadeIn key="step3" style={styles.top}>
            <ProgressDots active={2} />
            <Text style={styles.sectionLabel}>Notifications</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.heading}>Notifications</Text>
            <Text style={styles.body}>
              Panim sends your snippets as notifications at times you choose — a
              gentle prompt to pause and meditate. You can use the Settings tab
              to customize your notifications.
            </Text>
          </FadeIn>
          <View style={styles.buttonStack}>
            <Button label="Allow Notifications" onPress={handleAllowNotifications} />
            <Button label="Skip for now" variant="ghost" onPress={next} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Step 4 — Rhythm
  if (step === 4) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <FadeIn key="step4" style={styles.top}>
            <ProgressDots active={3} />
            <Text style={styles.sectionLabel}>Your rhythm</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.heading}>When would you like to pause?</Text>
            <Text style={styles.subheading}>
              You can adjust this anytime in Settings.
            </Text>
            <View style={styles.frequencyGrid}>
              {FREQUENCY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.freqCard,
                    frequency === opt.value && styles.freqCardSelected,
                  ]}
                  onPress={() => setFrequency(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.freqLabel}>{opt.label}</Text>
                  <Text style={styles.freqDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FadeIn>
          <Button label="Continue" onPress={handleRhythmContinue} />
        </View>
      </SafeAreaView>
    );
  }

  // Step 5 — You're all set
  if (step === 5) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <FadeIn key="step5" style={styles.top}>
            <Text style={styles.heading}>You&apos;re all set</Text>
            <Text style={styles.body}>
              We&apos;ve added a few scripture collections to get you started.
              Feel free to explore, or create your first snippet now.
            </Text>
          </FadeIn>
          <View style={styles.buttonStack}>
            <Button label="Explore Snippets" onPress={() => handleComplete("home")} />
            <Button label="Create a Snippet" variant="ghost" onPress={() => handleComplete("create")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  // Shared layout
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  top: {
    flex: 1,
    justifyContent: "center",
  },
  topCentered: {
    alignItems: "center",
  },

  // Shared buttons
  buttonStack: {
    gap: spacing.sm,
  },

  // Shared text
  heading: {
    ...typography.display,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.accent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },

  // Gold divider
  goldDivider: {
    width: 36,
    height: 1.5,
    backgroundColor: colors.accent,
    marginBottom: spacing.lg,
  },

  // Progress dots
  dotsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },

  // Step 1 — Brand
  hebrew: {
    fontFamily: "NotoRashiHebrew_400Regular",
    fontSize: 72,
    lineHeight: 86,
    color: colors.textSoft,
    textAlign: "center",
    writingDirection: "rtl",
    marginBottom: spacing.sm,
  },
  transliteration: {
    ...typography.scriptureItalic,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    letterSpacing: 1.5,
    marginBottom: spacing.xl,
  },
  appName: {
    ...typography.heading,
    fontSize: 24,
    letterSpacing: 3,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  partOfSpeech: {
    ...typography.label,
    color: colors.accent,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  definition: {
    ...typography.scripture,
    fontSize: 16,
    lineHeight: 28,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  definitionItalic: {
    fontFamily: fonts.serifItalic,
  },
  verseBlock: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.md,
    marginBottom: spacing.xl,
    alignSelf: "stretch",
  },
  verseText: {
    ...typography.scriptureItalic,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSoft,
  },
  verseReference: {
    ...typography.reference,
    color: colors.textSecondary,
  },

  // Step 4 — Rhythm
  subheading: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  frequencyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  freqCard: {
    width: "48%",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  freqCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  freqLabel: {
    ...typography.title,
    color: colors.textSoft,
    marginBottom: spacing.xs,
  },
  freqDesc: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
