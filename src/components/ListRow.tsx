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
import { StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
  icon?: IoniconName;
  onPress: () => void;
  onLongPress?: () => void;
};

// Tappable navigation row: optional leading icon, title, subtitle, chevron
export function ListRow({ title, subtitle, icon, onPress, onLongPress }: Props) {
  return (
    <PressableScale
      style={styles.row}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={layout.icon} color={colors.accent} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={layout.iconSm}
        color={colors.textSecondary}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md + spacing.xs,
    paddingHorizontal: spacing.md + spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconWrap: {
    width: layout.iconButton + spacing.xs,
    height: layout.iconButton + spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.label,
    marginTop: spacing.xs / 2,
  },
});
