import { colors, layout } from "@/src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

// Trailing arrow on rows that open another screen or picker
export function Chevron() {
  return (
    <Ionicons
      name="chevron-forward"
      size={layout.iconSm}
      color={colors.textSecondary}
    />
  );
}

// Marks the selected option in a list of choices
export function SelectedCheck() {
  return (
    <Ionicons name="checkmark" size={layout.icon} color={colors.accent} />
  );
}
