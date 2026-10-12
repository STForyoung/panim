import { IconButton } from "@/src/components/IconButton";
import { spacing } from "@/src/constants/theme";
import { StyleSheet, View } from "react-native";

type Props = {
  onBack: () => void;
  // Action buttons shown on the right
  children?: React.ReactNode;
};

export function ScreenHeader({ onBack, children }: Props) {
  return (
    <View style={styles.header}>
      <IconButton
        icon="chevron-back"
        onPress={onBack}
        accessibilityLabel="Back"
      />
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
