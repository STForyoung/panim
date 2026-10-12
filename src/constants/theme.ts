export const colors = {
  background: "#EEECE6",
  surface: "#FDFCF9",
  textPrimary: "#232527",
  textSoft: "#41454A",
  textSecondary: "#666A6E",
  textHeading: "#1B1D1F",
  accent: "#2F6B62",
  accentSoft: "#DCE7E2",
  accentTint: "#EEF3F0",
  onAccent: "#FDFCF9",
  border: "#DEDBD4",
  danger: "#B03A2E",
};

// Serif family for scripture, reflections and titles.
// To go back to Lora, swap these for the Lora_* names (still loaded in app/_layout.tsx)
// and restore the larger sizes below.
export const fonts = {
  serif: "Merriweather_300Light",
  serifItalic: "Merriweather_300Light_Italic",
  serifSemiBold: "Merriweather_600SemiBold",
  serifBold: "Merriweather_700Bold",
};

export const typography = {
  // Screen titles
  display: {
    fontFamily: fonts.serifBold,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: colors.textHeading,
  },
  heading: {
    fontFamily: fonts.serifBold,
    fontSize: 19,
    lineHeight: 28,
    color: colors.textHeading,
  },
  // Section and card titles
  title: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textHeading,
  },
  // Passage preview on the Home card
  scriptureHero: {
    fontFamily: fonts.serif,
    fontSize: 17.5,
    lineHeight: 31,
    color: colors.textPrimary,
  },
  // Passage where it is read in full: the snippet screen and the Bible tab
  scriptureLarge: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 32,
    color: colors.textPrimary,
  },
  scripture: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  scriptureItalic: {
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  reflection: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  // Reflection preview on the Home card
  reflectionMedium: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  // Reflection and prayer where they are read in full
  reflectionLarge: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  reference: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.3,
    color: colors.textPrimary,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500" as const,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    color: colors.textSecondary,
  },
  // Bible version beside a reference: small, spaced and quiet
  translationTag: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  button: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 20,
};

// Fixed control dimensions
export const layout = {
  controlHeight: 52,
  textArea: 128,
  iconButton: 40,
  fab: 56,
  icon: 22,
  iconSm: 18,
  miniCardWidth: 232,
  tabPillWidth: 64,
  tabPillHeight: 32,
};

// Cards are flat; only elements that float above content cast a shadow
export const shadows = {
  floating: {
    shadowColor: colors.textHeading,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
};
