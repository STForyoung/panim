import { useState } from "react";
import {
  Animated,
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  // Fade slightly while pressed. Turn off for cards with tinted areas inside,
  // where the fade shows through as uneven colour.
  dim?: boolean;
  children?: React.ReactNode;
};

// Pressable that gently shrinks and dims while held, then springs back
export function PressableScale({
  style,
  scaleTo = 0.97,
  dim = true,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const [pressed] = useState(() => new Animated.Value(0));

  function animate(toValue: number) {
    Animated.spring(pressed, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }

  const scale = pressed.interpolate({
    inputRange: [0, 1],
    outputRange: [1, scaleTo],
  });
  const opacity = pressed.interpolate({
    inputRange: [0, 1],
    outputRange: [1, dim ? 0.85 : 1],
  });

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        animate(1);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        animate(0);
        onPressOut?.(e);
      }}
      style={[style, { opacity, transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
