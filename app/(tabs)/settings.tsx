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
      setTopics(t);
      setLoading(false);
    }
    load();
  }, [db]);

  async function handleTranslationChange(
    translation: NotificationSchedule["translation"],
  ) {
    await updateSchedule(db, { translation });
    setSchedule((prev) => (prev ? { ...prev, translation } : prev));
    await scheduleNotifications(db);
  }

  async function handleRemoveTime(time: string) {
    if (!schedule) return;
    const times = schedule.times.filter((t) => t !== time);
    await updateSchedule(db, { times });
    setSchedule({ ...schedule, times });
    await scheduleNotifications(db);
  }

  async function handleAddTime() {
    if (!schedule) return;
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
    if (schedule.times.includes(time)) {
      setTimeError("That time is already added.");
      return;
    }

    const times = [...schedule.times, time].sort();
    await updateSchedule(db, { times });
    setSchedule({ ...schedule, times });
    setHourInput("");
    setMinuteInput("");
    setTimeError(null);
    setAddTimeVisible(false);
    await scheduleNotifications(db);
  }

  async function handleModeChange(mode: "random" | "topic") {
    if (!schedule) return;
    const update = mode === "random" ? { mode, activeTopic: null } : { mode };
    await updateSchedule(db, update);
    setSchedule({ ...schedule, ...update });
    await scheduleNotifications(db);
  }

  async function handleTopicSelect(topicId: string) {
    if (!schedule) return;
    await updateSchedule(db, { activeTopic: topicId });
    setSchedule({ ...schedule, activeTopic: topicId });
    setTopicPickerVisible(false);
    await scheduleNotifications(db);
  }

  async function handleGenerateTimes() {
    if (!schedule) return;

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

    const merged = Array.from(
      new Set([...schedule.times, ...generated]),
    ).sort();
    await updateSchedule(db, { times: merged });
    setSchedule({ ...schedule, times: merged });
    await scheduleNotifications(db);
  }

  async function handleSelectionOrderChange(
    selectionOrder: "random" | "sequential",
  ) {
    if (!schedule) return;
    await updateSchedule(db, { selectionOrder });
    setSchedule({ ...schedule, selectionOrder });
    await scheduleNotifications(db);
  }

  if (loading || !schedule) {
    return (
      <View>
        <Text>Loading…</Text>
      </View>
    );
  }

  const activeTopicName = schedule.activeTopic
    ? (topics.find((t) => t.id === schedule.activeTopic)?.name ??
      "Unknown topic")
    : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Translation */}
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
      {schedule.times.length === 0 ? (
        <Text>No times set.</Text>
      ) : (
        schedule.times.map((time) => (
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
        <Text>{schedule.mode === "random" ? "[x]" : "[ ]"} Random</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleModeChange("topic")}>
        <Text>{schedule.mode === "topic" ? "[x]" : "[ ]"} Topic Focus</Text>
      </TouchableOpacity>

      {schedule.mode === "topic" ? (
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
                    {schedule.activeTopic === topic.id ? "[x]" : "[ ]"}{" "}
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
        <Text>
          {schedule.selectionOrder === "random" ? "[x]" : "[ ]"} Random
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleSelectionOrderChange("sequential")}
      >
        <Text>
          {schedule.selectionOrder === "sequential" ? "[x]" : "[ ]"} Sequential
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
