import { colors, spacing, typography } from "@/src/constants/theme";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const TABS: Record<string, { icon: FeatherIconName; label: string }> = {
  index: { icon: "home", label: "Home" },
  library: { icon: "book-open", label: "Library" },
  settings: { icon: "settings", label: "Settings" },
};

type Props = {
  state: any;
  descriptors: any;
  navigation: any;
};

export function TabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route: any, index: number) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const isActive = state.index === index;

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(route.name)}
          >
            <View
              style={[
                styles.indicator,
                isActive ? styles.indicatorActive : styles.indicatorInactive,
              ]}
            />
            <Feather
              name={tab.icon}
              size={18}
              color={isActive ? colors.accent : colors.textSecondary}
            />
            <Text
              style={[
                styles.label,
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  indicator: {
    height: 2,
    width: 24,
    borderRadius: 1,
    alignSelf: "center",
    marginBottom: spacing.xs,
  },
  indicatorActive: {
    backgroundColor: colors.accent,
  },
  indicatorInactive: {
    backgroundColor: "transparent",
  },
  label: {
    ...typography.label,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  labelInactive: {
    color: colors.textSecondary,
  },
});
