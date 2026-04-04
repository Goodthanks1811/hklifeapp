import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";

interface Props {
  style?: ViewStyle;
  size?: number;
  stroke?: number;
}

export function PageLoader({ style, size = 48, stroke = 5 }: Props) {
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rot, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[s.container, style]}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: "#E03131",
            borderTopColor: "rgba(224,49,49,0.15)",
          }}
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
