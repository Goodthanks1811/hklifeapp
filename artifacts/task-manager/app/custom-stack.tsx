import { withLayoutContext } from "expo-router";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";

const { Navigator } = createStackNavigator();

// JS-based stack — gives full control over each screen's easing independently
export const CustomStack = withLayoutContext(Navigator);

// Asymmetric slide:
//   Incoming screen  — fast ease-out (covers most of the distance in the first 55% of the animation)
//   Outgoing screen  — slow, subtle left drift + slight fade (barely moves while new screen flies in)
export function asymmetricSlide({
  current,
  next,
  layouts,
}: Parameters<typeof CardStyleInterpolators.forHorizontalIOS>[0]) {
  const W = layouts.screen.width;

  // Incoming: accelerated ease-out — 95 % of travel done by progress = 0.55
  const translateIn = current.progress.interpolate({
    inputRange:  [0,    0.55,          1],
    outputRange: [W,    W * 0.05,      0],
    extrapolate: "clamp",
  });

  // Outgoing: barely drifts — moves only 10 % of screen width over the full transition
  const translateOut = next
    ? next.progress.interpolate({
        inputRange:  [0, 1],
        outputRange: [0, -W * 0.10],
        extrapolate: "clamp",
      })
    : 0;

  // Outgoing: gentle opacity reduction so new screen "pops" over it
  const opacity = next
    ? next.progress.interpolate({
        inputRange:  [0, 1],
        outputRange: [1, 0.78],
        extrapolate: "clamp",
      })
    : 1;

  return {
    cardStyle:      { transform: [{ translateX: translateIn }] },
    containerStyle: { transform: [{ translateX: translateOut }], opacity },
  };
}

export const TRANSITION_SPEC = {
  animation: "timing" as const,
  config: { duration: 380, useNativeDriver: true },
};
