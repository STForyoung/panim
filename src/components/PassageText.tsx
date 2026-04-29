import { colors, spacing, typography } from "@/src/constants/theme";
import { type PassageVerse } from "@/src/db/snippets";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  verses: PassageVerse[];
  numberOfLines?: number;
};

export function PassageText({ verses, numberOfLines }: Props) {
  return (
    <View style={styles.container}>
      {verses.map((v, i) => (
        <View key={`${v.chapter}-${v.verse}`} style={styles.verseRow}>
          <Text style={styles.verseNumber}>{v.verse}</Text>
          <Text
            style={styles.verseText}
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
  verseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  verseNumber: {
    fontSize: 10,
    fontFamily: "Lora_400Regular",
    color: colors.textSecondary,
    marginTop: 3,
  },
  verseText: {
    ...typography.scriptureItalic,
    flex: 1,
  },
});
