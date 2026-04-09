import { withLayoutContext } from "expo-router";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import { Easing } from "react-native";

const { Navigator } = createStackNavigator();

// JS-based stack — gives full control over each screen's easing independently
export const CustomStack = withLayoutContext(Navigator);

// Consistent slide:
//   Incoming screen  — linear translateX from full-width to 0, driven by ease-out
//                      so it starts at full speed and decelerates smoothly to rest.
//                      No kinks, no compound curves — one smooth velocity profile.
//   Outgoing screen  — subtle left drift + slight fade, same easing
export function asymmetricSlide({
  current,
  next,
  layouts,
}: Parameters<typeof CardStyleInterpolators.forHorizontalIOS>[0]) {
  const W = layouts.screen.width;

  // Incoming: straight linear interpolation — easing is handled entirely by
  // TRANSITION_SPEC so there's only one velocity curve, not two compounded.
  const translateIn = current.progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [W, 0],
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

// Push (open): ease-out cubic — starts at full speed, decelerates to a smooth stop.
// The visible deceleration as the screen settles makes the full 380 ms feel complete.
export const TRANSITION_SPEC = {
  animation: "timing" as const,
  config: { duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true },
};

// Pop (close): ease-in-out cubic — starts gently so the departure is visibly weighted,
// then accelerates off-screen. Without a slow start, ease-out on departure only shows
// the fast burst (the tail is already off-screen), making it feel twice as quick.
export const TRANSITION_SPEC_CLOSE = {
  animation: "timing" as const,
  config: { duration: 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: true },
};
