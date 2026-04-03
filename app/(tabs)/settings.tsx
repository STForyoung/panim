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
import { useSQLiteContext } from "expo-sqlite";
import {
  type NotificationSchedule,
  getSchedule,
  updateSchedule,
} from "@/src/db/notificationSchedule";
import { type Topic, getAllTopics } from "@/src/db/topics";

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
    translation: NotificationSchedule["translation"]
  ) {
    await updateSchedule(db, { translation });
    setSchedule((prev) => prev ? { ...prev, translation } : prev);
  }

  async function handleRemoveTime(time: string) {
    if (!schedule) return;
    const times = schedule.times.filter((t) => t !== time);
    await updateSchedule(db, { times });
    setSchedule({ ...schedule, times });
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
  }

  async function handleModeChange(mode: "random" | "topic") {
    if (!schedule) return;
    const update =
      mode === "random"
        ? { mode, activeTopic: null }
        : { mode };
    await updateSchedule(db, update);
    setSchedule({ ...schedule, ...update });
  }

  async function handleTopicSelect(topicId: string) {
    if (!schedule) return;
    await updateSchedule(db, { activeTopic: topicId });
    setSchedule({ ...schedule, activeTopic: topicId });
    setTopicPickerVisible(false);
  }

  async function handleSelectionOrderChange(
    selectionOrder: "random" | "sequential"
  ) {
    if (!schedule) return;
    await updateSchedule(db, { selectionOrder });
    setSchedule({ ...schedule, selectionOrder });
  }

  if (loading || !schedule) {
    return (
      <View>
        <Text>Loading…</Text>
      </View>
    );
  }

  const activeTopicName =
    schedule.activeTopic
      ? topics.find((t) => t.id === schedule.activeTopic)?.name ?? "Unknown topic"
      : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Translation */}
      <Text>Translation</Text>
      <Text>Applies to new snippets only</Text>
      {TRANSLATIONS.map((t) => (
        <TouchableOpacity key={t} onPress={() => handleTranslationChange(t)}>
          <Text>{schedule.translation === t ? "[x]" : "[ ]"} {t}</Text>
        </TouchableOpacity>
      ))}

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
          <Text>
            Active topic: {activeTopicName ?? "None selected"}
          </Text>
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
