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
      <Text style={styles.passage} numberOfLines={2}>{snippet.passage.map((v) => v.text).join(" ")}</Text>
      {snippet.reflection ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.reflection} numberOfLines={2}>{snippet.reflection}</Text>
        </>
      ) : null}
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
    color: colors.textSecondary,
  },
  reflection: {
    ...typography.scripture,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  passage: {
    ...typography.scriptureItalic,
  },
});
