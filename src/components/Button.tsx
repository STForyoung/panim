import { type IoniconName } from "@/src/components/IconButton";
import { PressableScale } from "@/src/components/PressableScale";
import {
  colors,
  layout,
  radius,
  spacing,
  typography,
} from "@/src/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { type StyleProp, StyleSheet, Text, type ViewStyle } from "react-native";

type Variant = "primary" | "tonal" | "ghost" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IoniconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: colors.onAccent,
  tonal: colors.accent,
  ghost: colors.textSecondary,
  danger: colors.danger,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  style,
}: Props) {
  const color = TEXT_COLOR[variant];
  return (
    <PressableScale
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "tonal" && styles.tonal,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <Ionicons name={icon} size={layout.iconSm} color={color} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.controlHeight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  tonal: {
    backgroundColor: colors.accentSoft,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.button,
  },
});
