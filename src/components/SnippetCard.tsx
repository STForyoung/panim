import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type Snippet } from '@/src/db/snippets';
import { getDisplayReference } from '@/src/utils/displayReference';
import { colors, radius, shadows, spacing, typography } from '@/src/constants/theme';

type Props = {
  snippet: Snippet;
  onPress: () => void;
};

export function SnippetCard({ snippet, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.reference}>{getDisplayReference(snippet)}</Text>
      <Text style={styles.passage} numberOfLines={2}>{snippet.passage}</Text>
      <Text style={styles.reflection} numberOfLines={2}>{snippet.reflection}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.card,
  },
  reference: {
    ...typography.reference,
  },
  passage: {
    ...typography.scripture,
  },
  reflection: {
    ...typography.reflection,
    color: colors.textSecondary,
  },
});
