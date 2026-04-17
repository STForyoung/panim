import { colors, radius, spacing, typography } from "@/src/constants/theme";
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

const FREQUENCY_TIMES: Record<string, string[]> = {
  "1": ["09:00"],
  "3": ["09:00", "12:00", "18:00"],
  "5": ["09:00", "12:00", "15:00", "18:00", "21:00"],
};

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const [step, setStep] = useState(1);
  const [frequency, setFrequency] = useState("3");

  async function handleRhythmContinue() {
    const times = FREQUENCY_TIMES[frequency] ?? FREQUENCY_TIMES["3"];
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
          <View style={[styles.top, styles.topCentered]}>
            <Text style={styles.hebrew}>פָּנִים</Text>
            <Text style={styles.transliteration}>pā·nîm</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.appName}>PANIM</Text>
            <Text style={styles.partOfSpeech}>[Hebrew noun]</Text>
            <Text style={styles.definition}>
              <Text style={styles.definitionItalic}>
                &ldquo;Face, presence, countenance.&rdquo;
              </Text>{" "}
              — the word used throughout Scripture for the direct, personal
              presence of God. May this app help you seek His face. Amen
            </Text>
            <View style={styles.verseBlock}>
              <Text style={styles.verseText}>
                Your face, Lord, I will seek.
              </Text>
              <Text style={styles.verseReference}>Psalm 27:8</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={next}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Begin</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step 2 — How it works
  if (step === 2) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.top}>
            <ProgressDots active={1} />
            <Text style={styles.sectionLabel}>Your meditations</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.heading}>How it works</Text>
            <Text style={styles.body}>
              Create snippets from Bible passages with your reflections.
            </Text>
            <Text style={styles.body}>Organise them by topic.</Text>
            <Text style={styles.body}>
              Receive them as notifications throughout your day as quiet
              reminders to pause and meditate.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={next}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step 3 — Notifications
  if (step === 3) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.top}>
            <ProgressDots active={2} />
            <Text style={styles.sectionLabel}>Notifications</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.heading}>Notifications</Text>
            <Text style={styles.body}>
              Panim sends your snippets as notifications at times you choose — a
              gentle prompt to pause and meditate. You can set your schedule in
              Settings at any time.
            </Text>
          </View>
          <View style={styles.buttonStack}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAllowNotifications}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Allow Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={next}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Step 4 — Rhythm
  if (step === 4) {
    const options = [
      { value: "1", freq: "1×", desc: "Morning" },
      { value: "3", freq: "3×", desc: "Morn · Noon\n· Eve" },
      { value: "5", freq: "5×", desc: "Throughout\nthe day" },
    ];

    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.top}>
            <ProgressDots active={3} />
            <Text style={styles.sectionLabel}>Your rhythm</Text>
            <View style={styles.goldDivider} />
            <Text style={styles.heading}>When would you like to pause?</Text>
            <Text style={styles.subheading}>
              You can adjust this anytime in Settings.
            </Text>
            <View style={styles.frequencyRow}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.freqCard,
                    frequency === opt.value && styles.freqCardSelected,
                  ]}
                  onPress={() => setFrequency(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.freqLabel}>{opt.freq}</Text>
                  <Text style={styles.freqDesc}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRhythmContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step 5 — You're all set
  if (step === 5) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.top}>
            <Text style={styles.heading}>You&apos;re all set</Text>
            <Text style={styles.body}>
              We&apos;ve added a few scripture collections to get you started.
              Feel free to explore, or create your first snippet now.
            </Text>
          </View>
          <View style={styles.buttonStack}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleComplete("home")}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Explore Snippets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleComplete("create")}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Create a Snippet</Text>
            </TouchableOpacity>
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
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.surface,
  },
  secondaryButton: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },

  // Shared text
  heading: {
    ...typography.heading,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 28,
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
    fontFamily: "NotoSerifHebrew_400Regular",
    fontSize: 72,
    lineHeight: 86,
    color: colors.textPrimary,
    textAlign: "center",
    writingDirection: "rtl",
    marginBottom: spacing.sm,
  },
  transliteration: {
    ...typography.scriptureItalic,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    letterSpacing: 1.5,
    marginBottom: spacing.xl,
  },
  appName: {
    ...typography.heading,
    fontSize: 28,
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
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  definitionItalic: {
    fontFamily: "Lora_400Regular_Italic",
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
    fontSize: 13,
    lineHeight: 21,
    color: "#4a3f3a",
  },
  verseReference: {
    ...typography.reference,
    color: colors.textSecondary,
  },

  // Step 4 — Rhythm
  subheading: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  frequencyRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  freqCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  freqCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "#faf7f3",
  },
  freqLabel: {
    ...typography.button,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  freqDesc: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
