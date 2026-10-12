import { PressableScale } from '@/src/components/PressableScale';
import { colors, radius, spacing, typography } from '@/src/constants/theme';
import { type Snippet } from '@/src/db/snippets';
import { getDisplayReference } from '@/src/utils/displayReference';
import { StyleSheet, Text } from 'react-native';

type Props = {
  snippet: Snippet;
  onPress: () => void;
};

export function SnippetCard({ snippet, onPress }: Props) {
  return (
    <PressableScale style={styles.card} onPress={onPress} accessibilityRole="button">
      <Text style={styles.reference}>{getDisplayReference(snippet)}</Text>
      <Text style={styles.passage} numberOfLines={3}>{snippet.passage.map((v) => v.text).join(" ")}</Text>
      {snippet.reflection ? (
        <Text style={styles.reflection} numberOfLines={2}>{snippet.reflection}</Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  reference: {
    ...typography.reference,
    color: colors.accent,
  },
  passage: {
    ...typography.scripture,
  },
  reflection: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
