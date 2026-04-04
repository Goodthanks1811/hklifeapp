import React from "react";
import { ActivityIndicator, StyleSheet, View, ViewStyle } from "react-native";

interface Props {
  style?: ViewStyle;
}

export function PageLoader({ style }: Props) {
  return (
    <View style={[s.container, style]}>
      <ActivityIndicator size="large" color="#E03131" />
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
