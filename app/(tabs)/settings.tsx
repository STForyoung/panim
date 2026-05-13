import {
  colors,
  radius,
  shadows,
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
import { BOOK_IDS } from "@/src/services/bibleService";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const TRANSLATIONS: NotificationSchedule["translation"][] = [
  "NKJV",
  "NIV",
  "ESV",
  "NASB",
  "NLT",
  "KJV",
];

const TRANSLATION_NAMES: Record<NotificationSchedule["translation"], string> = {
  NKJV: "New King James Version",
  NIV: "New International Version",
  ESV: "English Standard Version",
  NASB: "New American Standard Bible",
  NLT: "New Living Translation",
  KJV: "King James Version",
};

// 24h "HH:MM" strings
const PRESETS: { label: string; sublabel: string; times: string[] }[] = [
  { label: "1× Daily", sublabel: "12:00 PM", times: ["12:00"] },
  { label: "2× Daily", sublabel: "9 AM · 6 PM", times: ["09:00", "18:00"] },
  {
    label: "3× Daily",
    sublabel: "9 AM · 12 PM · 6 PM",
    times: ["09:00", "12:00", "18:00"],
  },
  {
    label: "4× Daily",
    sublabel: "9 AM · 12 PM · 3 PM · 6 PM",
    times: ["09:00", "12:00", "15:00", "18:00"],
  },
  {
    label: "5× Daily",
    sublabel: "9 AM · 12 PM · 3 PM · 6 PM · 9 PM",
    times: ["09:00", "12:00", "15:00", "18:00", "21:00"],
  },
  {
    label: "Hourly",
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

  function handleSelectionOrderChange(selectionOrder: "random" | "sequential") {
    setPendingSelectionOrder(selectionOrder);
    setApplyMessage(null);
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
        <View style={styles.centeredState}>
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.rowLabel}>
              {TRANSLATION_NAMES[schedule.translation]}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Translation Picker Modal */}
        <Modal visible={translationPickerVisible} animationType="slide">
          <View style={styles.screen}>
            <View
              style={[
                styles.modalHeader,
                { paddingTop: insets.top + spacing.md },
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
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.modalRow,
                      selected && styles.rowSelected,
                      i === TRANSLATIONS.length - 1 && styles.rowLast,
                    ]}
                    onPress={() => {
                      handleTranslationChange(t);
                      setTranslationPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.rowLabel}>{TRANSLATION_NAMES[t]}</Text>
                    {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>

        {/* Notification Schedule */}
        <Text style={styles.categoryHeader}>Notification Schedule</Text>
        <Text style={styles.categoryNote}>When you receive reminders</Text>

        {/* Presets */}
        <Text style={styles.sectionHeader}>PRESETS</Text>
        <View style={styles.presetChipRow}>
          {PRESETS.map((preset) => {
            const isActive =
              JSON.stringify(pendingTimes) === JSON.stringify(preset.times);
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.presetChip, isActive && styles.presetChipActive]}
                onPress={() => handleApplyPreset(preset.times)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    isActive && styles.presetChipTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {(() => {
          const active = PRESETS.find(
            (p) => JSON.stringify(pendingTimes) === JSON.stringify(p.times),
          );
          return active ? (
            <Text style={styles.presetActiveDetail}>{active.sublabel}</Text>
          ) : null;
        })()}

        {/* Scheduled Times */}
        <Text style={styles.sectionHeader}>YOUR TIMES</Text>
        {pendingTimes.length === 0 ? (
          <Text style={styles.mutedText}>No times set.</Text>
        ) : (
          <View style={styles.sectionCard}>
            {pendingTimes.map((time, i) => (
              <View
                key={time}
                style={[
                  styles.row,
                  styles.rowSpaceBetween,
                  i === pendingTimes.length - 1 && styles.rowLast,
                ]}
              >
                <Text style={styles.rowLabel}>{to12h(time)}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveTime(time)}
                  hitSlop={8}
                >
                  <Text style={styles.removeButton}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={openAddTime}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineButtonText}>+ Custom Time</Text>
        </TouchableOpacity>

        {pendingTimes.length > 0 ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setPendingTimes([])}
            activeOpacity={0.8}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        ) : null}

        {/* Add Time Modal */}
        <Modal visible={addTimeVisible} animationType="slide">
          <View style={styles.screen}>
            <View
              style={[
                styles.modalHeader,
                { paddingTop: insets.top + spacing.md },
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
                  <Text style={styles.pickerSectionLabel}>HOUR</Text>
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
                  <Text style={styles.pickerSectionLabel}>MINUTE</Text>
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

        {/* Notification Preferences */}
        <Text style={styles.categoryHeader}>Notification Preferences</Text>
        <Text style={styles.categoryNote}>What gets sent in each reminder</Text>

        {/* Topic Picker Modal */}
        <Modal visible={topicPickerVisible} animationType="slide">
          <View style={styles.screen}>
            <View
              style={[
                styles.modalHeader,
                { paddingTop: insets.top + spacing.md },
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
                    <Text style={styles.chevron}>›</Text>
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
                    <Text style={styles.chevron}>›</Text>
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
                    <Text style={styles.chevron}>›</Text>
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
                    <Text style={styles.chevron}>›</Text>
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
                        selected && styles.rowSelected,
                        i === topicsForSelectedType.length - 1 &&
                          styles.rowLast,
                      ]}
                      onPress={() => handleTopicSelect(topic.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rowLabel}>{topic.name}</Text>
                      {selected ? (
                        <Text style={styles.checkmark}>✓</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Modal>

        <View style={styles.sectionCard}>
          {/* Mode */}
          <View
            style={[styles.row, styles.rowSpaceBetween, styles.prefGroupLabel]}
          >
            <Text style={styles.prefLabel}>MODE</Text>
          </View>
          {(["random", "topic", "favourites"] as const).map((mode) => {
            const selected = pendingMode === mode;
            const label =
              mode === "random"
                ? "Random"
                : mode === "topic"
                  ? "Topic Focus"
                  : "Favourites";
            return (
              <View key={mode}>
                <TouchableOpacity
                  style={[
                    styles.row,
                    styles.rowSpaceBetween,
                    selected && styles.rowSelected,
                  ]}
                  onPress={() => handleModeChange(mode)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rowLabel}>{label}</Text>
                  {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                </TouchableOpacity>
                {mode === "topic" && pendingMode === "topic" ? (
                  <TouchableOpacity
                    style={[styles.row, styles.topicPickerRow]}
                    onPress={openTopicPicker}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.topicPickerText}>
                      {activeTopicName ?? "Select a topic…"}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}

          {/* Content */}
          <View
            style={[styles.row, styles.rowSpaceBetween, styles.prefGroupLabel]}
          >
            <Text style={styles.prefLabel}>CONTENT</Text>
          </View>
          {(["passage", "reflection", "prayer"] as const).map((content) => {
            const selected = pendingNotificationContent === content;
            const label =
              content === "passage"
                ? "Passage"
                : content === "reflection"
                  ? "Meditation"
                  : "Prayer";
            return (
              <TouchableOpacity
                key={content}
                style={[
                  styles.row,
                  styles.rowSpaceBetween,
                  selected && styles.rowSelected,
                ]}
                onPress={() => {
                  setPendingNotificationContent(content);
                  setApplyMessage(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.rowLabel}>{label}</Text>
                {selected ? <Text style={styles.checkmark}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}

          {/* Selection Order */}
          <View
            style={[styles.row, styles.rowSpaceBetween, styles.prefGroupLabel]}
          >
            <Text style={styles.prefLabel}>SELECTION ORDER</Text>
          </View>
          {(["random", "sequential"] as const).map((order, i) => {
            const selected = pendingSelectionOrder === order;
            const label = order === "random" ? "Random" : "Sequential";
            return (
              <TouchableOpacity
                key={order}
                style={[
                  styles.row,
                  styles.rowSpaceBetween,
                  selected && styles.rowSelected,
                  i === 1 && styles.rowLast,
                ]}
                onPress={() => handleSelectionOrderChange(order)}
                activeOpacity={0.7}
              >
                <Text style={styles.rowLabel}>{label}</Text>
                {selected ? <Text style={styles.checkmark}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {applyError ? <Text style={styles.errorText}>{applyError}</Text> : null}
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
    paddingBottom: spacing.lg,
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
    ...typography.heading,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  // Category headers
  categoryHeader: {
    ...typography.heading,
    fontSize: 18,
    color: colors.textHeading,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  categoryNote: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Section pattern
  sectionHeader: {
    ...typography.label,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadows.card,
  },

  // Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowSpaceBetween: {
    justifyContent: "space-between",
  },
  rowSelected: {
    backgroundColor: colors.accent + "33",
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  rowLabel: {
    ...typography.body,
  },
  checkmark: {
    ...typography.body,
    color: colors.accent,
  },

  // Preset chips
  presetChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  presetChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  presetChipText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  presetChipTextActive: {
    color: colors.surface,
    fontWeight: "600",
  },
  presetActiveDetail: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Remove time button
  removeButton: {
    ...typography.body,
    color: colors.danger,
  },

  // Add Time outline button
  outlineButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  outlineButtonText: {
    ...typography.button,
    color: colors.surface,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  clearButtonText: {
    ...typography.button,
    color: colors.danger,
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
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timePickerInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    width: 72,
    fontSize: 32,
    fontWeight: "300" as const,
    color: colors.textHeading,
    textAlign: "center",
  },
  timePickerSeparator: {
    fontSize: 32,
    fontWeight: "300" as const,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  amPmStack: {
    gap: spacing.xs,
  },
  amPmButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  amPmButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  amPmText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  amPmTextActive: {
    color: colors.surface,
  },

  // Preference group labels (inside consolidated card)
  prefGroupLabel: {
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  prefLabel: {
    ...typography.label,
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },

  // Topic picker row (inside mode card)
  topicPickerRow: {
    paddingLeft: spacing.xl,
    justifyContent: "space-between",
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.accent + "0D",
  },
  topicPickerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chevron: {
    ...typography.body,
    color: colors.textSecondary,
  },
  topicTypeTag: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Error
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },

  // Sticky footer
  scrollWithFooter: {
    paddingBottom: spacing.xl * 2 + 52,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
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
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
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
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.surface,
  },

  // Modal
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCancelArea: {
    minWidth: 60,
  },
  modalCancel: {
    ...typography.button,
    color: colors.accent,
  },
  modalDone: {
    textAlign: "right",
  },
  modalTitle: {
    ...typography.heading,
    flex: 1,
    textAlign: "center",
    fontSize: 17,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
