export const colors = {
  background: "#f4f1ed",
  surface: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B6460",
  accent: "#C4A882",
  border: "#E8E4DF",
  danger: "#C0392B",
};

export const typography = {
  scripture: {
    fontFamily: "Lora_400Regular",
    fontSize: 17,
    lineHeight: 27,
    color: "#1A1A1A",
  },
  scriptureItalic: {
    fontFamily: "Lora_400Regular_Italic",
    fontSize: 18,
    lineHeight: 28,
    color: "#1A1A1A",
  },
  reflection: {
    fontFamily: "Lora_400Regular_Italic",
    fontSize: 15,
    lineHeight: 24,
    color: "#1A1A1A",
  },
  reference: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.5,
    color: "#1A1A1A",
  },
  heading: {
    fontFamily: "Lora_700Bold",
    fontSize: 22,
    lineHeight: 30,
    color: "#1A1A1A",
  },
  label: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: "#6B6460",
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1A1A1A",
  },
  button: {
    fontSize: 15,
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
  md: 12,
  lg: 20,
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
};
