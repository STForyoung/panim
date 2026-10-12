import { PressableScale } from "@/src/components/PressableScale";
import { colors, layout, radius, shadows, spacing } from "@/src/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
};

// Floating "+" button pinned to the bottom-right of a screen
export function Fab({ onPress, accessibilityLabel }: Props) {
  return (
    <PressableScale
      style={styles.fab}
      scaleTo={0.92}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="add" size={layout.icon + spacing.xs} color={colors.onAccent} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: layout.fab,
    height: layout.fab,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.floating,
  },
});
