import {
  type NotificationSchedule,
  getSchedule,
  updateSchedule,
} from "@/src/db/notificationSchedule";
import { type Topic, getAllTopics } from "@/src/db/topics";
import { scheduleNotifications } from "@/src/notifications/scheduler";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TRANSLATIONS: NotificationSchedule["translation"][] = [
  "NKJV",
  "NIV",
  "ESV",
  "NASB",
  "NLT",
  "KJV",
];

export default function SettingsScreen() {
  const db = useSQLiteContext();

  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<NotificationSchedule | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Pending schedule state — not saved until Apply is tapped
  const [pendingTimes, setPendingTimes] = useState<string[]>([]);
  const [pendingMode, setPendingMode] = useState<"random" | "topic">("random");
  const [pendingActiveTopic, setPendingActiveTopic] = useState<string | null>(
    null,
  );
  const [pendingSelectionOrder, setPendingSelectionOrder] = useState<
    "random" | "sequential"
  >("random");

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

  // Quick Setup
  const [qsStartHour, setQsStartHour] = useState("8");
  const [qsStartMinute, setQsStartMinute] = useState("0");
  const [qsEndHour, setQsEndHour] = useState("22");
  const [qsEndMinute, setQsEndMinute] = useState("0");
  const [qsInterval, setQsInterval] = useState<1 | 2 | 3 | 4 | null>(null);
  const [qsError, setQsError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [s, t] = await Promise.all([getSchedule(db), getAllTopics(db)]);
      setSchedule(s);
      setPendingTimes(s.times);
      setPendingMode(s.mode);
      setPendingActiveTopic(s.activeTopic);
      setPendingSelectionOrder(s.selectionOrder);
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

  function handleModeChange(mode: "random" | "topic") {
    setPendingMode(mode);
    if (mode === "random") setPendingActiveTopic(null);
    setApplyMessage(null);
  }

  function handleTopicSelect(topicId: string) {
    setPendingActiveTopic(topicId);
    setTopicPickerVisible(false);
    setApplyMessage(null);
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
      });
      setSchedule((prev) =>
        prev
          ? {
              ...prev,
              times: pendingTimes,
              mode: pendingMode,
              activeTopic: pendingActiveTopic,
              selectionOrder: pendingSelectionOrder,
            }
          : prev,
      );
      await scheduleNotifications(db);
      setApplyMessage("Schedule updated");
    } catch (e) {
      setApplyError(
        e instanceof Error ? e.message : "Failed to save schedule.",
      );
    } finally {
      setIsApplying(false);
    }
  }

  if (loading || !schedule) {
    return (
      <View>
        <Text>Loading…</Text>
      </View>
    );
  }

  const activeTopicName = pendingActiveTopic
    ? (topics.find((t) => t.id === pendingActiveTopic)?.name ?? "Unknown topic")
    : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Translation — saves immediately */}
      <Text>Translation</Text>
      <Text>Applies to new snippets only</Text>
      {TRANSLATIONS.map((t) => (
        <TouchableOpacity key={t} onPress={() => handleTranslationChange(t)}>
          <Text>
            {schedule.translation === t ? "[x]" : "[ ]"} {t}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Quick Setup */}
      <Text>Quick Setup</Text>

      <Text>Start Time</Text>
      <View>
        <Text>Hour (0–23)</Text>
        <TextInput
          value={qsStartHour}
          onChangeText={setQsStartHour}
          keyboardType="number-pad"
          placeholder="8"
        />
        <Text>Minute (0–59)</Text>
        <TextInput
          value={qsStartMinute}
          onChangeText={setQsStartMinute}
          keyboardType="number-pad"
          placeholder="0"
        />
      </View>

      <Text>End Time</Text>
      <View>
        <Text>Hour (0–23)</Text>
        <TextInput
          value={qsEndHour}
          onChangeText={setQsEndHour}
          keyboardType="number-pad"
          placeholder="22"
        />
        <Text>Minute (0–59)</Text>
        <TextInput
          value={qsEndMinute}
          onChangeText={setQsEndMinute}
          keyboardType="number-pad"
          placeholder="0"
        />
      </View>

      <Text>Interval</Text>
      <View>
        {([1, 2, 3, 4] as const).map((h) => (
          <TouchableOpacity key={h} onPress={() => setQsInterval(h)}>
            <Text>
              {qsInterval === h ? "[x]" : "[ ]"} Every {h}h
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {qsError ? <Text>{qsError}</Text> : null}

      <TouchableOpacity onPress={handleGenerateTimes}>
        <Text>Generate Times</Text>
      </TouchableOpacity>
      <Text>Generated times are added to your existing schedule</Text>

      {/* Notification Times */}
      <Text>Notification Times</Text>
      {pendingTimes.length === 0 ? (
        <Text>No times set.</Text>
      ) : (
        pendingTimes.map((time) => (
          <View key={time}>
            <Text>{time}</Text>
            <TouchableOpacity onPress={() => handleRemoveTime(time)}>
              <Text>Remove</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      <TouchableOpacity
        onPress={() => {
          setHourInput("");
          setMinuteInput("");
          setTimeError(null);
          setAddTimeVisible(true);
        }}
      >
        <Text>Add Time</Text>
      </TouchableOpacity>

      <Modal visible={addTimeVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text>Add Notification Time</Text>
            <Text>Hour (0–23)</Text>
            <TextInput
              value={hourInput}
              onChangeText={setHourInput}
              keyboardType="number-pad"
              placeholder="7"
            />
            <Text>Minute (0–59)</Text>
            <TextInput
              value={minuteInput}
              onChangeText={setMinuteInput}
              keyboardType="number-pad"
              placeholder="0"
            />
            {timeError ? <Text>{timeError}</Text> : null}
            <TouchableOpacity onPress={handleAddTime}>
              <Text>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAddTimeVisible(false)}>
              <Text>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Notification Mode */}
      <Text>Notification Mode</Text>
      <TouchableOpacity onPress={() => handleModeChange("random")}>
        <Text>{pendingMode === "random" ? "[x]" : "[ ]"} Random</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleModeChange("topic")}>
        <Text>{pendingMode === "topic" ? "[x]" : "[ ]"} Topic Focus</Text>
      </TouchableOpacity>

      {pendingMode === "topic" ? (
        <View>
          <Text>Active topic: {activeTopicName ?? "None selected"}</Text>
          <TouchableOpacity onPress={() => setTopicPickerVisible(true)}>
            <Text>Select Topic</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={topicPickerVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TouchableOpacity onPress={() => setTopicPickerVisible(false)}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <Text>Select Active Topic</Text>
            {topics.length === 0 ? (
              <Text>No topics yet.</Text>
            ) : (
              topics.map((topic) => (
                <TouchableOpacity
                  key={topic.id}
                  onPress={() => handleTopicSelect(topic.id)}
                >
                  <Text>
                    {pendingActiveTopic === topic.id ? "[x]" : "[ ]"}{" "}
                    {topic.name} ({topic.type})
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Selection Order */}
      <Text>Selection Order</Text>
      <TouchableOpacity onPress={() => handleSelectionOrderChange("random")}>
        <Text>{pendingSelectionOrder === "random" ? "[x]" : "[ ]"} Random</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleSelectionOrderChange("sequential")}
      >
        <Text>
          {pendingSelectionOrder === "sequential" ? "[x]" : "[ ]"} Sequential
        </Text>
      </TouchableOpacity>

      {/* Apply */}
      {applyMessage ? <Text>{applyMessage}</Text> : null}
      {applyError ? <Text>{applyError}</Text> : null}
      <TouchableOpacity onPress={handleApply} disabled={isApplying}>
        <Text>{isApplying ? "Applying…" : "Apply Schedule"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
