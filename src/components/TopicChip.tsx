import { colors, layout, radius, spacing, typography } from '@/src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  name: string;
  onRemove?: () => void;
};

export function TopicChip({ name, onRemove }: Props) {
  return (
    <View style={styles.chip}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
        >
          <Ionicons name="close" size={layout.iconSm - spacing.xs} color={colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md - spacing.xs,
    paddingVertical: spacing.xs + spacing.xs / 2,
    gap: spacing.xs,
    alignSelf: 'flex-start',
    // A long name is cut off with "…" instead of running past the card's edge
    maxWidth: '100%',
  },
  name: {
    ...typography.label,
    color: colors.accent,
    flexShrink: 1,
  },
});
