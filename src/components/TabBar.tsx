import { type IoniconName } from "@/src/components/IconButton";
import { PressableScale } from "@/src/components/PressableScale";
import {
  colors,
  layout,
  spacing,
  typography,
} from "@/src/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TABS: Record<
  string,
  { icon: IoniconName; activeIcon: IoniconName; label: string }
> = {
  index: { icon: "home-outline", activeIcon: "home", label: "Home" },
  bible: { icon: "book-outline", activeIcon: "book", label: "Bible" },
  library: { icon: "library-outline", activeIcon: "library", label: "Library" },
  settings: {
    icon: "settings-outline",
    activeIcon: "settings",
    label: "Settings",
  },
};

type Props = {
  state: any;
  descriptors: any;
  navigation: any;
};

export function TabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          // On iPhone the inset is the home-indicator area, which already leaves room under
          // the labels. On Android it is the system navigation bar itself, so the labels need
          // their own space above it or the bar looks cramped.
          paddingBottom:
            Platform.OS === "android"
              ? insets.bottom + spacing.sm
              : Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const isActive = state.index === index;

        return (
          <PressableScale
            key={route.key}
            style={styles.tab}
            scaleTo={0.94}
            onPress={() => navigation.navigate(route.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.pill, isActive && styles.pillActive]}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={layout.icon}
                color={isActive ? colors.accent : colors.textSecondary}
              />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  pill: {
    width: layout.tabPillWidth,
    height: layout.tabPillHeight,
    // Exactly half the height, so the ends are full semicircles on every platform
    borderRadius: layout.tabPillHeight / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: colors.accentSoft,
  },
  label: {
    ...typography.caption,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: "700",
  },
});
