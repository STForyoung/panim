import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/src/constants/theme';

type Props = {
  name: string;
  onRemove?: () => void;
};

export function TopicChip({ name, onRemove }: Props) {
  return (
    <View style={styles.chip}>
      <Text style={styles.name}>{name}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={8}>
          <Text style={styles.remove}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  name: {
    ...typography.label,
    color: colors.surface,
  },
  remove: {
    fontSize: 14,
    color: colors.surface,
    lineHeight: 16,
  },
});
