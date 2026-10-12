import { Chevron, SelectedCheck } from "@/src/components/Icons";
import { LoadingState } from "@/src/components/StateViews";
import {
  colors,
  layout,
  radius,
  spacing,
  typography,
} from "@/src/constants/theme";
import {
  type NotificationSchedule,
  getSchedule,
  updateSchedule,
} from "@/src/db/notificationSchedule";
import { type Topic, getAllTopics } from "@/src/db/topics";
import { scheduleNotifications } from "@/src/notifications/scheduler";
import {
  BOOK_IDS,
  type TranslationAvailability,
  getTranslationAvailability,
} from "@/src/services/bibleService";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const TRANSLATIONS: NotificationSchedule["translation"][] = [
  "NKJV",
  "ESV",
  "NASB",
  "NLT",
  "KJV",
];

const TRANSLATION_NAMES: Record<NotificationSchedule["translation"], string> = {
  NKJV: "New King James Version",
  ESV: "English Standard Version",
  NASB: "New American Standard Bible",
  NLT: "New Living Translation",
  KJV: "King James Version",
};

// Shown under each translation so it is clear which ones need a connection
const AVAILABILITY_NOTES: Record<TranslationAvailability, string> = {
  offline: "Available offline",
  online: "Online only",
  unavailable: "Not currently available",
};

// 24h "HH:MM" strings
const PRESETS: {
  label: string;
  short: string;
  sublabel: string;
  times: string[];
}[] = [
  { label: "1× Daily",
    short: "1×", sublabel: "12:00 PM", times: ["12:00"] },
  { label: "2× Daily",
    short: "2×", sublabel: "9 AM · 6 PM", times: ["09:00", "18:00"] },
  {
    label: "3× Daily",
    short: "3×",
    sublabel: "9 AM · 12 PM · 6 PM",
    times: ["09:00", "12:00", "18:00"],
  },
  {
    label: "4× Daily",
    short: "4×",
    sublabel: "9 AM · 12 PM · 3 PM · 6 PM",
    times: ["09:00", "12:00", "15:00", "18:00"],
  },
  {
    label: "5× Daily",
    short: "5×",
    sublabel: "9 AM · 12 PM · 3 PM · 6 PM · 9 PM",
    times: ["09:00", "12:00", "15:00", "18:00", "21:00"],
  },
  {
    label: "Hourly",
    short: "Hourly",
    sublabel: "Every hour from 9 AM to 6 PM",
    times: [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ],
  },
];

// Which snippets reminders are drawn from
const MODE_OPTIONS = {
  random: "All snippets",
  topic: "One topic",
  favourites: "Favourites only",
};

// What the notification text is taken from
const CONTENT_OPTIONS = {
  passage: "Passage",
  reflection: "Reflection",
  prayer: "Prayer",
};

function to12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function SettingsScreen() {
  const db = useSQLiteContext();

  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<NotificationSchedule | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Pending schedule state — not saved until Apply is tapped
  const [pendingTimes, setPendingTimes] = useState<string[]>([]);
  const [pendingMode, setPendingMode] = useState<
    "random" | "topic" | "favourites"
  >("random");
  const [pendingActiveTopic, setPendingActiveTopic] = useState<string | null>(
    null,
  );
  const [pendingSelectionOrder, setPendingSelectionOrder] = useState<
    "random" | "sequential"
  >("random");
  const [pendingNotificationContent, setPendingNotificationContent] = useState<
    "passage" | "reflection" | "prayer"
  >("passage");

  // Apply state
  const [isApplying, setIsApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Add time modal
  const [addTimeVisible, setAddTimeVisible] = useState(false);
  const [pickerHour, setPickerHour] = useState("9");
  const [pickerMinute, setPickerMinute] = useState("00");
  const [pickerAmPm, setPickerAmPm] = useState<"AM" | "PM">("AM");
  const [timeError, setTimeError] = useState<string | null>(null);

  // Translation picker modal
  const [translationPickerVisible, setTranslationPickerVisible] =
    useState(false);

  // Topic picker modal
  const [topicPickerVisible, setTopicPickerVisible] = useState(false);
  const [topicPickerType, setTopicPickerType] = useState<Topic["type"] | null>(
    null,
  );
  const [bookTopicSection, setBookTopicSection] = useState<"OT" | "NT" | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        setApplyMessage(null);
      };
    }, []),
  );

  useEffect(() => {
    async function load() {
      const [s, t] = await Promise.all([getSchedule(db), getAllTopics(db)]);
      setSchedule(s);
      setPendingTimes(s.times);
      setPendingMode(s.mode);
      setPendingActiveTopic(s.activeTopic);
      setPendingSelectionOrder(s.selectionOrder);
      setPendingNotificationContent(s.notificationContent);
      setTopics(t);
      setLoading(false);
    }
    load();
  }, [db]);

  // Translation saves immediately — independent of schedule
  async function handleTranslationChange(
    translation: NotificationSchedule["translation"],
  ) {
    await updateSchedule(db, { translation });
    setSchedule((prev) => (prev ? { ...prev, translation } : prev));
    await scheduleNotifications(db);
  }

  function handleRemoveTime(time: string) {
    setPendingTimes((prev) => prev.filter((t) => t !== time));
    setApplyMessage(null);
  }

  function handleApplyPreset(times: string[]) {
    setPendingTimes(times);
    setApplyMessage(null);
  }

  function handleConfirmAddTime() {
    const h = parseInt(pickerHour, 10);
    const m = parseInt(pickerMinute, 10);

    if (isNaN(h) || h < 1 || h > 12) {
      setTimeError("Hour must be between 1 and 12.");
      return;
    }
    if (isNaN(m) || m < 0 || m > 59) {
      setTimeError("Minute must be between 0 and 59.");
      return;
    }

    let h24 = h % 12;
    if (pickerAmPm === "PM") h24 += 12;
    const time = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    if (pendingTimes.includes(time)) {
      setTimeError("That time is already in your schedule.");
      return;
    }

    setPendingTimes((prev) => [...prev, time].sort());
    setTimeError(null);
    setAddTimeVisible(false);
    setApplyMessage(null);
  }

  function openAddTime() {
    setPickerHour("");
    setPickerMinute("");
    setPickerAmPm("AM");
    setTimeError(null);
    setAddTimeVisible(true);
  }

  function handleModeChange(mode: "random" | "topic" | "favourites") {
    setPendingMode(mode);
    if (mode !== "topic") setPendingActiveTopic(null);
    setApplyMessage(null);
  }

  function handleTopicSelect(topicId: string) {
    setPendingActiveTopic(topicId);
    setTopicPickerType(null);
    setBookTopicSection(null);
    setTopicPickerVisible(false);
    setApplyMessage(null);
  }

  function openTopicPicker() {
    setTopicPickerType(null);
    setBookTopicSection(null);
    setTopicPickerVisible(true);
  }

  function closeTopicPicker() {
    setTopicPickerVisible(false);
    setTopicPickerType(null);
    setBookTopicSection(null);
  }

  async function handleApply() {
    setIsApplying(true);
    setApplyMessage(null);
    setApplyError(null);
    try {
      await updateSchedule(db, {
        times: pendingTimes,
        mode: pendingMode,
        activeTopic: pendingActiveTopic,
        selectionOrder: pendingSelectionOrder,
        notificationContent: pendingNotificationContent,
      });
      setSchedule((prev) =>
        prev
          ? {
              ...prev,
              times: pendingTimes,
              mode: pendingMode,
              activeTopic: pendingActiveTopic,
              selectionOrder: pendingSelectionOrder,
              notificationContent: pendingNotificationContent,
            }
          : prev,
      );
      await scheduleNotifications(db);
      setApplyMessage("Schedule updated");
      setTimeout(() => setApplyMessage(null), 3000);
    } catch (e) {
      setApplyError(
        e instanceof Error ? e.message : "Failed to save schedule.",
      );
    } finally {
      setIsApplying(false);
    }
  }

  function handleCancel() {
    if (!schedule) return;
    setPendingTimes(schedule.times);
    setPendingMode(schedule.mode);
    setPendingActiveTopic(schedule.activeTopic ?? null);
    setPendingSelectionOrder(schedule.selectionOrder);
    setPendingNotificationContent(schedule.notificationContent);
  }

  const hasUnsavedChanges =
    schedule != null &&
    (JSON.stringify(pendingTimes) !== JSON.stringify(schedule.times) ||
      pendingMode !== schedule.mode ||
      pendingActiveTopic !== schedule.activeTopic ||
      pendingSelectionOrder !== schedule.selectionOrder ||
      pendingNotificationContent !== schedule.notificationContent);

  if (loading || !schedule) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  // Scheduled times sit in a three-column grid
  const timeTileWidth = Math.floor(
    (windowWidth - spacing.lg * 2 - spacing.sm * 2) / 3,
  );

  // Pickers open as sheets on iOS, which start below the status bar
  const sheetTopInset =
    Platform.OS === "ios" ? spacing.lg : insets.top + spacing.md;

  const activeTopicName = pendingActiveTopic
    ? (topics.find((t) => t.id === pendingActiveTopic)?.name ?? "Unknown topic")
    : null;
  const customTopics = topics.filter((topic) => topic.type === "custom");
  const bookTopics = topics.filter((topic) => topic.type === "book");
  const otBookTopics = bookTopics.filter((t) => (BOOK_IDS[t.name] ?? 0) <= 39);
  const ntBookTopics = bookTopics.filter((t) => (BOOK_IDS[t.name] ?? 0) >= 40);
  const topicsForSelectedType =
    topicPickerType === "custom"
      ? customTopics
      : topicPickerType === "book" && bookTopicSection === "OT"
        ? otBookTopics
        : topicPickerType === "book" && bookTopicSection === "NT"
          ? ntBookTopics
          : [];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          hasUnsavedChanges && styles.scrollWithFooter,
        ]}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Bible Translation */}
        <Text style={styles.categoryHeader}>Bible Translation</Text>
        <Text style={styles.categoryNote}>Applies to new snippets only</Text>

        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={[styles.row, styles.rowSpaceBetween, styles.rowLast]}
            onPress={() => setTranslationPickerVisible(true)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.rowLabel}>
                {TRANSLATION_NAMES[schedule.translation]}
              </Text>
              <Text style={styles.topicTypeTag}>
                {
                  AVAILABILITY_NOTES[
                    getTranslationAvailability(schedule.translation)
                  ]
                }
              </Text>
            </View>
            <Chevron />
          </TouchableOpacity>
        </View>

        {/* Reminders */}
        <Text style={styles.categoryHeader}>Reminders</Text>

        {/* Presets */}
        <Text style={styles.sectionHeader}>Times per day</Text>
        <View style={styles.segmented}>
          {PRESETS.map((preset) => {
            const isActive =
              JSON.stringify(pendingTimes) === JSON.stringify(preset.times);
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.segment, isActive && styles.segmentActive]}
                onPress={() => handleApplyPreset(preset.times)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={preset.label}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    isActive && styles.segmentTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {preset.short}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Scheduled Times */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderInline}>Your times</Text>
          {pendingTimes.length > 0 ? (
            <TouchableOpacity
              onPress={() => setPendingTimes([])}
              hitSlop={spacing.sm}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {pendingTimes.length === 0 ? (
          <Text style={styles.timesEmpty}>
            Reminders are off. Pick how many times a day, or add a time.
          </Text>
        ) : null}
        <View style={styles.timeGrid}>
          {pendingTimes.map((time) => (
            <View key={time} style={[styles.timeTile, { width: timeTileWidth }]}>
              <Text
                style={styles.timeTileText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {to12h(time)}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemoveTime(time)}
                hitSlop={spacing.sm}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${to12h(time)}`}
              >
                <Ionicons
                  name="close"
                  size={layout.iconSm - spacing.xs}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[
              styles.timeTile,
              styles.addTimeTile,
              { width: timeTileWidth },
            ]}
            onPress={openAddTime}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={layout.iconSm} color={colors.accent} />
            <Text style={styles.addTimeText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Mode */}
        <Text style={styles.sectionHeader}>Which snippets to send</Text>
        <View style={styles.sectionCard}>
          {(["random", "topic", "favourites"] as const).map((mode) => {
            const selected = pendingMode === mode;
            const label = MODE_OPTIONS[mode];
            return (
              <View key={mode}>
                <TouchableOpacity
                  style={[
                    styles.row,
                    styles.rowSpaceBetween,
                    mode === "favourites" && styles.rowLast,
                  ]}
                  onPress={() => handleModeChange(mode)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rowLabel}>{label}</Text>
                  {selected ? <SelectedCheck /> : null}
                </TouchableOpacity>
                {mode === "topic" && pendingMode === "topic" ? (
                  <TouchableOpacity
                    style={[styles.row, styles.topicPickerRow]}
                    onPress={openTopicPicker}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.topicPickerText}>
                      {activeTopicName ?? "Choose a topic…"}
                    </Text>
                    <Chevron />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Content */}
        <Text style={styles.sectionHeader}>What each reminder shows</Text>
        <View style={styles.sectionCard}>
          {(["passage", "reflection", "prayer"] as const).map((content) => {
            const selected = pendingNotificationContent === content;
            const label = CONTENT_OPTIONS[content];
            return (
              <TouchableOpacity
                key={content}
                style={[
                  styles.row,
                  styles.rowSpaceBetween,
                  content === "prayer" && styles.rowLast,
                ]}
                onPress={() => {
                  setPendingNotificationContent(content);
                  setApplyMessage(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.rowLabel}>{label}</Text>
                {selected ? <SelectedCheck /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {applyError ? <Text style={styles.errorText}>{applyError}</Text> : null}

        {/* Translation Picker Modal */}
        <Modal visible={translationPickerVisible} animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setTranslationPickerVisible(false)}
        >
          <View style={styles.screen}>
            <View
              style={[
                styles.modalHeader,
                { paddingTop: sheetTopInset },
              ]}
            >
              <TouchableOpacity
                style={styles.modalCancelArea}
                onPress={() => setTranslationPickerVisible(false)}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Translation</Text>
              <View style={styles.modalCancelArea} />
            </View>
            <ScrollView>
              {TRANSLATIONS.map((t, i) => {
                const selected = schedule.translation === t;
                const unavailable =
                  getTranslationAvailability(t) === "unavailable";
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.modalRow,
                      i === TRANSLATIONS.length - 1 && styles.rowLast,
                      unavailable && styles.rowUnavailable,
                    ]}
                    onPress={() => {
                      handleTranslationChange(t);
                      setTranslationPickerVisible(false);
                    }}
                    disabled={unavailable}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.rowLabel}>{TRANSLATION_NAMES[t]}</Text>
                      <Text style={styles.topicTypeTag}>
                        {AVAILABILITY_NOTES[getTranslationAvailability(t)]}
                      </Text>
                    </View>
                    {selected ? <SelectedCheck /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>

        {/* Add Time Modal */}
        <Modal visible={addTimeVisible} animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setAddTimeVisible(false)}
        >
          <View style={styles.screen}>
            <View
              style={[
                styles.modalHeader,
                { paddingTop: sheetTopInset },
              ]}
            >
              <TouchableOpacity
                style={styles.modalCancelArea}
                onPress={() => setAddTimeVisible(false)}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Time</Text>
              <TouchableOpacity
                style={styles.modalCancelArea}
                onPress={handleConfirmAddTime}
              >
                <Text style={[styles.modalCancel, styles.modalDone]}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.timePickerRow}>
                <View style={styles.timePickerField}>
                  <Text style={styles.pickerSectionLabel}>Hour</Text>
                  <TextInput
                    style={styles.timePickerInput}
                    value={pickerHour}
                    onChangeText={setPickerHour}
                    keyboardType="number-pad"
                    textAlign="center"
                    maxLength={2}
                    autoFocus
                  />
                </View>
                <Text style={styles.timePickerSeparator}>:</Text>
                <View style={styles.timePickerField}>
                  <Text style={styles.pickerSectionLabel}>Minute</Text>
                  <TextInput
                    style={styles.timePickerInput}
                    value={pickerMinute}
                    onChangeText={setPickerMinute}
                    keyboardType="number-pad"
                    textAlign="center"
                    maxLength={2}
                  />
                </View>
                <View style={styles.amPmStack}>
                  {(["AM", "PM"] as const).map((suffix) => (
                    <TouchableOpacity
                      key={suffix}
                      style={[
                        styles.amPmButton,
                        pickerAmPm === suffix && styles.amPmButtonActive,
                      ]}
                      onPress={() => setPickerAmPm(suffix)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.amPmText,
                          pickerAmPm === suffix && styles.amPmTextActive,
                        ]}
                      >
                        {suffix}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {timeError ? (
                <Text style={styles.errorText}>{timeError}</Text>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Topic Picker Modal */}
        <Modal visible={topicPickerVisible} animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeTopicPicker}
        >
          <View style={styles.screen}>
            <View
              style={[
                styles.modalHeader,
                { paddingTop: sheetTopInset },
              ]}
            >
              <TouchableOpacity
                style={styles.modalCancelArea}
                onPress={() => {
                  if (bookTopicSection) {
                    setBookTopicSection(null);
                  } else if (topicPickerType) {
                    setTopicPickerType(null);
                  } else {
                    closeTopicPicker();
                  }
                }}
              >
                <Text style={styles.modalCancel}>
                  {topicPickerType ? "Back" : "Cancel"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {bookTopicSection === "OT"
                  ? "Old Testament"
                  : bookTopicSection === "NT"
                    ? "New Testament"
                    : topicPickerType === "custom"
                      ? "Select Topic"
                      : topicPickerType === "book"
                        ? "Select Testament"
                        : "Select Topic Type"}
              </Text>
              <View style={styles.modalCancelArea} />
            </View>
            <ScrollView>
              {topics.length === 0 ? (
                <View style={styles.centeredState}>
                  <Text style={styles.mutedText}>No topics yet.</Text>
                </View>
              ) : !topicPickerType ? (
                <>
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => setTopicPickerType("custom")}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.rowLabel}>My Topics</Text>
                      <Text style={styles.topicTypeTag}>
                        {customTopics.length} available
                      </Text>
                    </View>
                    <Chevron />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalRow, styles.rowLast]}
                    onPress={() => setTopicPickerType("book")}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.rowLabel}>Bible Books</Text>
                      <Text style={styles.topicTypeTag}>
                        {bookTopics.length} available
                      </Text>
                    </View>
                    <Chevron />
                  </TouchableOpacity>
                </>
              ) : topicPickerType === "book" && !bookTopicSection ? (
                <>
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => setBookTopicSection("OT")}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.rowLabel}>Old Testament</Text>
                      <Text style={styles.topicTypeTag}>
                        {otBookTopics.length} available
                      </Text>
                    </View>
                    <Chevron />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalRow, styles.rowLast]}
                    onPress={() => setBookTopicSection("NT")}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.rowLabel}>New Testament</Text>
                      <Text style={styles.topicTypeTag}>
                        {ntBookTopics.length} available
                      </Text>
                    </View>
                    <Chevron />
                  </TouchableOpacity>
                </>
              ) : topicsForSelectedType.length === 0 ? (
                <View style={styles.centeredState}>
                  <Text style={styles.mutedText}>
                    No topics in this category yet.
                  </Text>
                </View>
              ) : (
                topicsForSelectedType.map((topic, i) => {
                  const selected = pendingActiveTopic === topic.id;
                  return (
                    <TouchableOpacity
                      key={topic.id}
                      style={[
                        styles.modalRow,
                        i === topicsForSelectedType.length - 1 &&
                          styles.rowLast,
                      ]}
                      onPress={() => handleTopicSelect(topic.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rowLabel}>{topic.name}</Text>
                      {selected ? <SelectedCheck /> : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>

      {hasUnsavedChanges ? (
        <View style={styles.stickyFooter}>
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isApplying}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, isApplying && styles.buttonDisabled]}
              onPress={handleApply}
              disabled={isApplying}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {isApplying ? "Applying…" : "Apply"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : applyMessage ? (
        <View style={styles.stickyFooter}>
          <Text style={styles.applySuccess}>{applyMessage}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  mutedText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Title
  title: {
    ...typography.display,
    marginTop: spacing.md,
  },

  // Category headers
  categoryHeader: {
    ...typography.heading,
    marginTop: spacing.xl,
  },
  categoryNote: {
    ...typography.label,
    marginTop: spacing.xs / 2,
    marginBottom: spacing.md,
  },

  // Section pattern
  sectionHeader: {
    ...typography.label,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
  },

  // Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowUnavailable: {
    opacity: 0.5,
  },
  rowSpaceBetween: {
    justifyContent: "space-between",
  },
  rowLabel: {
    ...typography.body,
  },

  // Times-per-day segmented control
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: layout.controlHeight - spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.onAccent,
  },

  // Scheduled times
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeaderInline: {
    ...typography.label,
  },
  clearButtonText: {
    ...typography.label,
    color: colors.danger,
  },
  timesEmpty: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  timeTile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    minHeight: layout.controlHeight - spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md - spacing.xs,
    backgroundColor: colors.surface,
  },
  timeTileText: {
    ...typography.body,
    flexShrink: 1,
  },
  addTimeTile: {
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  addTimeText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
  },

  // Add Time modal inputs
  timePickerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  timePickerField: {
    alignItems: "center",
  },
  pickerSectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  timePickerInput: {
    ...typography.display,
    lineHeight: undefined, // lineHeight on single-line TextInput clips descenders on iOS
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minWidth: layout.fab + spacing.lg,
    textAlign: "center",
  },
  timePickerSeparator: {
    ...typography.display,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  amPmStack: {
    gap: spacing.xs,
  },
  amPmButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  amPmButtonActive: {
    backgroundColor: colors.accent,
  },
  amPmText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  amPmTextActive: {
    color: colors.onAccent,
  },

  // Topic picker row (inside mode card)
  topicPickerRow: {
    paddingLeft: spacing.xl,
    justifyContent: "space-between",
    backgroundColor: colors.background + "80",
  },
  topicPickerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  topicTypeTag: {
    ...typography.label,
    marginTop: spacing.xs / 2,
  },

  // Error
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },

  // Sticky footer
  scrollWithFooter: {
    paddingBottom: spacing.xl * 2 + layout.controlHeight,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  // Apply button
  applyButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: layout.controlHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minHeight: layout.controlHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  applySuccess: {
    ...typography.label,
    color: colors.accent,
    textAlign: "center",
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.onAccent,
  },

  // Modal
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalCancelArea: {
    minWidth: layout.fab + spacing.sm,
  },
  modalCancel: {
    ...typography.button,
    color: colors.accent,
  },
  modalDone: {
    textAlign: "right",
  },
  modalTitle: {
    ...typography.title,
    flex: 1,
    textAlign: "center",
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: layout.controlHeight + spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
