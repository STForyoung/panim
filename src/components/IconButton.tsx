import { PressableScale } from "@/src/components/PressableScale";
import { colors, layout, spacing } from "@/src/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  icon: IoniconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  disabled?: boolean;
  // Solid accent background, for the primary action on a screen
  filled?: boolean;
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.textPrimary,
  disabled,
  filled,
}: Props) {
  return (
    <PressableScale
      style={[
        styles.button,
        filled && styles.filled,
        disabled && filled && styles.disabled,
      ]}
      scaleTo={0.9}
      onPress={onPress}
      disabled={disabled}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons
        name={icon}
        size={layout.icon}
        color={filled ? colors.onAccent : color}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: layout.iconButton / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: {
    backgroundColor: colors.accent,
  },
  disabled: {
    opacity: 0.5,
  },
});
