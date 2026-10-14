import { Button } from "@/src/components/Button";
import {
  colors,
  layout,
  radius,
  spacing,
  typography,
} from "@/src/constants/theme";
import { useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  title: string;
  // Name to start from; empty for a new topic
  initialName?: string;
  // Saves the trimmed name. Throwing shows the error and keeps the sheet open.
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
};

// Sheet with a single field for naming a topic, used to create and to rename
export function TopicNameSheet({ visible, onClose, ...rest }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* Mounted per opening, so the field always starts from the current name */}
      {visible ? <SheetContent onClose={onClose} {...rest} /> : null}
    </Modal>
  );
}

function SheetContent({
  title,
  initialName = "",
  onSave,
  onClose,
}: Omit<Props, "visible">) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sheets start below the status bar on iOS; Android shows the modal full screen
  const topInset = Platform.OS === "ios" ? spacing.lg : insets.top + spacing.md;

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Topic name is required.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save topic.");
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={onClose}
          disabled={isSaving}
          hitSlop={spacing.sm}
        >
          <Text style={styles.headerAction}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.body}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Topic name"
          placeholderTextColor={colors.textSecondary + "80"}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          label={isSaving ? "Saving…" : "Save"}
          onPress={handleSave}
          disabled={isSaving}
          style={styles.saveButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerSide: {
    minWidth: layout.fab + spacing.sm,
  },
  headerAction: {
    ...typography.button,
    color: colors.accent,
  },
  title: {
    ...typography.title,
    flex: 1,
    textAlign: "center",
  },
  body: {
    padding: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    lineHeight: undefined, // lineHeight on single-line TextInput clips descenders on iOS
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },
});
