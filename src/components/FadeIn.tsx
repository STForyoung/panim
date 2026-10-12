import { spacing } from "@/src/constants/theme";
import { useEffect, useState } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
};

// Fades content in with a slight upward drift when it first mounts
export function FadeIn({ children, style, delay = 0 }: Props) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay,
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [spacing.sm, 0],
  });

  return (
    <Animated.View
      style={[style, { opacity: progress, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
