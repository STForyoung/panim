import { colors, fonts, spacing, typography } from "@/src/constants/theme";
import { type PassageVerse } from "@/src/db/snippets";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  verses: PassageVerse[];
  numberOfLines?: number;
  // Larger type for screens where the passage is the focus
  large?: boolean;
};

export function PassageText({ verses, numberOfLines, large }: Props) {
  return (
    <View style={large ? styles.containerLarge : styles.container}>
      {verses.map((v, i) => (
        <View key={`${v.chapter}-${v.verse}`} style={styles.verseRow}>
          <Text style={[styles.verseNumber, large && styles.verseNumberLarge]}>
            {v.verse}
          </Text>
          <Text
            style={large ? styles.verseTextLarge : styles.verseText}
            numberOfLines={i === verses.length - 1 ? numberOfLines : undefined}
          >
            {v.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  containerLarge: {
    gap: spacing.sm,
  },
  verseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  verseNumber: {
    ...typography.caption,
    fontFamily: fonts.serifSemiBold,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  verseNumberLarge: {
    marginTop: spacing.sm,
  },
  verseText: {
    ...typography.scripture,
    flex: 1,
  },
  verseTextLarge: {
    ...typography.scriptureLarge,
    flex: 1,
  },
});
