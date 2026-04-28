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
  const [hourInput, setHourInput] = useState("");
  const [minuteInput, setMinuteInput] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);

  // Topic picker modal
  const [topicPickerVisible, setTopicPickerVisible] = useState(false);
  const [topicPickerType, setTopicPickerType] = useState<Topic["type"] | null>(
    null,
  );
  const [bookTopicSection, setBookTopicSection] = useState<"OT" | "NT" | null>(
    null,
  );

  // Quick Setup
  const [qsStartHour, setQsStartHour] = useState("8");
  const [qsStartMinute, setQsStartMinute] = useState("0");
  const [qsEndHour, setQsEndHour] = useState("22");
  const [qsEndMinute, setQsEndMinute] = useState("0");
  const [qsInterval, setQsInterval] = useState<1 | 2 | 3 | 4 | null>(null);
  const [qsError, setQsError] = useState<string | null>(null);

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

  function handleAddTime() {
    const hour = parseInt(hourInput, 10);
    const minute = parseInt(minuteInput, 10);

    if (isNaN(hour) || hour < 0 || hour > 23) {
      setTimeError("Hour must be between 0 and 23.");
      return;
    }
    if (isNaN(minute) || minute < 0 || minute > 59) {
      setTimeError("Minute must be between 0 and 59.");
      return;
    }

    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (pendingTimes.includes(time)) {
      setTimeError("That time is already added.");
      return;
    }

    setPendingTimes((prev) => [...prev, time].sort());
    setHourInput("");
    setMinuteInput("");
    setTimeError(null);
    setAddTimeVisible(false);
    setApplyMessage(null);
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

  function handleGenerateTimes() {
    const startH = parseInt(qsStartHour, 10);
    const startM = parseInt(qsStartMinute, 10);
    const endH = parseInt(qsEndHour, 10);
    const endM = parseInt(qsEndMinute, 10);

    if (isNaN(startH) || startH < 0 || startH > 23) {
      setQsError("Start hour must be between 0 and 23.");
      return;
    }
    if (isNaN(startM) || startM < 0 || startM > 59) {
      setQsError("Start minute must be between 0 and 59.");
      return;
    }
    if (isNaN(endH) || endH < 0 || endH > 23) {
      setQsError("End hour must be between 0 and 23.");
      return;
    }
    if (isNaN(endM) || endM < 0 || endM > 59) {
      setQsError("End minute must be between 0 and 59.");
      return;
    }
    if (startH * 60 + startM >= endH * 60 + endM) {
      setQsError("End time must be after start time.");
      return;
    }
    if (!qsInterval) {
      setQsError("Select an interval.");
      return;
    }

    setQsError(null);

    const generated: string[] = [];
    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes <= endMinutes) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      generated.push(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      );
      currentMinutes += qsInterval * 60;
    }

    const merged = Array.from(new Set([...pendingTimes, ...generated])).sort();
    setPendingTimes(merged);
    setApplyMessage(null);
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

        {/* Translation */}
        <Text style={styles.sectionHeader}>TRANSLATION</Text>
        <Text style={styles.sectionNote}>Applies to new snippets only</Text>
        <View style={styles.sectionCard}>
          {TRANSLATIONS.map((t, i) => {
            const selected = schedule.translation === t;
            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.row,
                  selected && styles.rowSelected,
                  i === TRANSLATIONS.length - 1 && styles.rowLast,
                ]}
                onPress={() => handleTranslationChange(t)}
                activeOpacity={0.7}
              >
                <Text style={styles.rowLabel}>{TRANSLATION_NAMES[t]}</Text>
                {selected ? <Text style={styles.checkmark}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Setup */}
        <Text style={styles.sectionHeader}>QUICK SETUP</Text>
        <View style={styles.sectionCard}>
          {/* Start time */}
          <View style={[styles.row, styles.rowSpaceBetween]}>
            <Text style={styles.rowLabel}>Start time</Text>
            <View style={styles.timeInputs}>
              <TextInput
                style={styles.timeInput}
                value={qsStartHour}
                onChangeText={setQsStartHour}
                keyboardType="number-pad"
                placeholder="8"
                placeholderTextColor={colors.textSecondary + "80"}
                textAlign="center"
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={qsStartMinute}
                onChangeText={setQsStartMinute}
                keyboardType="number-pad"
                placeholder="00"
                placeholderTextColor={colors.textSecondary + "80"}
                textAlign="center"
              />
            </View>
          </View>

          {/* End time */}
          <View style={[styles.row, styles.rowSpaceBetween]}>
            <Text style={styles.rowLabel}>End time</Text>
            <View style={styles.timeInputs}>
              <TextInput
                style={styles.timeInput}
                value={qsEndHour}
                onChangeText={setQsEndHour}
                keyboardType="number-pad"
                placeholder="22"
                placeholderTextColor={colors.textSecondary + "80"}
                textAlign="center"
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={qsEndMinute}
                onChangeText={setQsEndMinute}
                keyboardType="number-pad"
                placeholder="00"
                placeholderTextColor={colors.textSecondary + "80"}
                textAlign="center"
              />
            </View>
          </View>

          {/* Interval */}
          <View style={[styles.row, styles.rowLast, styles.rowSpaceBetween]}>
            <Text style={styles.rowLabel}>Interval</Text>
            <View style={styles.intervalButtons}>
              {([1, 2, 3, 4] as const).map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.intervalButton,
                    qsInterval === h && styles.intervalButtonActive,
                  ]}
                  onPress={() => setQsInterval(h)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.intervalButtonText,
                      qsInterval === h && styles.intervalButtonTextActive,
                    ]}
                  >
                    {h}h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {qsError ? <Text style={styles.errorText}>{qsError}</Text> : null}

        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateTimes}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Generate Times</Text>
        </TouchableOpacity>
        <Text style={styles.generateNote}>
          Generated times are added to your existing schedule
        </Text>

        {/* Scheduled Times */}
        <Text style={styles.sectionHeader}>SCHEDULED TIMES</Text>
        <View style={styles.sectionCard}>
          {pendingTimes.length === 0 ? (
            <View style={[styles.row, styles.rowLast]}>
              <Text style={styles.mutedText}>No times set.</Text>
            </View>
          ) : (
            pendingTimes.map((time, i) => (
              <View
                key={time}
                style={[
                  styles.row,
                  styles.rowSpaceBetween,
                  i === pendingTimes.length - 1 && styles.rowLast,
                ]}
              >
                <Text style={styles.rowLabel}>{time}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveTime(time)}
                  hitSlop={8}
                >
                  <Text style={styles.removeButton}>×</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => {
            setHourInput("");
            setMinuteInput("");
            setTimeError(null);
            setAddTimeVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineButtonText}>+ Add Time</Text>
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
              <View style={styles.modalCancelArea} />
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalTimeRow}>
                <View style={styles.modalTimeField}>
                  <Text style={styles.modalTimeLabel}>HOUR (0–23)</Text>
                  <TextInput
                    style={styles.modalTimeInput}
                    value={hourInput}
                    onChangeText={setHourInput}
                    keyboardType="number-pad"
                    placeholder="7"
                    placeholderTextColor={colors.textSecondary + "80"}
                    textAlign="center"
                    autoFocus
                  />
                </View>
                <Text style={styles.modalTimeSeparator}>:</Text>
                <View style={styles.modalTimeField}>
                  <Text style={styles.modalTimeLabel}>MINUTE (0–59)</Text>
                  <TextInput
                    style={styles.modalTimeInput}
                    value={minuteInput}
                    onChangeText={setMinuteInput}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary + "80"}
                    textAlign="center"
                  />
                </View>
              </View>
              {timeError ? (
                <Text style={styles.errorText}>{timeError}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.generateButton, { marginTop: spacing.lg }]}
                onPress={handleAddTime}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Notification Mode */}
        <Text style={styles.sectionHeader}>NOTIFICATION MODE</Text>
        <View style={styles.sectionCard}>
          {(["random", "topic", "favourites"] as const).map((mode, i, arr) => {
            const selected = pendingMode === mode;
            const label =
              mode === "random"
                ? "Random"
                : mode === "topic"
                  ? "Topic Focus"
                  : "Favourites";
            const isLast = i === arr.length - 1;
            return (
              <View key={mode}>
                <TouchableOpacity
                  style={[
                    styles.row,
                    styles.rowSpaceBetween,
                    selected && styles.rowSelected,
                    isLast && styles.rowLast,
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
        </View>

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

        {/* Notification Content */}
        <Text style={styles.sectionHeader}>NOTIFICATION CONTENT</Text>
        <Text style={styles.sectionNote}>What leads each notification</Text>
        <View style={styles.sectionCard}>
          {(["passage", "reflection", "prayer"] as const).map(
            (content, i, arr) => {
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
                    i === arr.length - 1 && styles.rowLast,
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
            },
          )}
        </View>

        {/* Selection Order */}
        <Text style={styles.sectionHeader}>SELECTION ORDER</Text>
        <View style={styles.sectionCard}>
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
    padding: spacing.lg,
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
    marginBottom: spacing.lg,
  },

  // Section pattern
  sectionHeader: {
    ...typography.label,
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionNote: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
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
    backgroundColor: colors.accent + "33", // ~20% opacity
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

  // Quick setup time inputs
  timeInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  timeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    width: 40,
    ...typography.body,
  },
  timeSeparator: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Interval buttons
  intervalButtons: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  intervalButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  intervalButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  intervalButtonText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  intervalButtonTextActive: {
    color: colors.surface,
  },

  // Generate button + note
  generateButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.surface,
  },
  generateNote: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },

  // Remove time button
  removeButton: {
    ...typography.body,
    color: colors.danger,
  },

  // Add Time outline button
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  outlineButtonText: {
    ...typography.button,
    color: colors.accent,
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

  // Topic picker row (inside mode card)
  topicPickerRow: {
    backgroundColor: colors.background,
    paddingLeft: spacing.lg,
    justifyContent: "space-between",
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
    paddingBottom: spacing.xl * 2 + 52, // reserve space for footer
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
  modalTitle: {
    ...typography.heading,
    flex: 1,
    textAlign: "center",
    fontSize: 17,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalTimeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalTimeField: {
    alignItems: "center",
  },
  modalTimeLabel: {
    ...typography.label,
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  modalTimeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    width: 80,
    ...typography.heading,
    textAlign: "center",
  },
  modalTimeSeparator: {
    ...typography.heading,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
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
