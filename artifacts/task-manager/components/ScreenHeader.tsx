import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type React from "react";
import Colors from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";

interface Props { title: string; right?: React.ReactNode; }

export function ScreenHeader({ title, right }: Props) {
  const { toggleDrawer } = useDrawer();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleDrawer(); }}
        style={styles.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="menu" size={20} color={Colors.textPrimary} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {right ? <View style={styles.rightSlot}>{right}</View> : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.darkBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.1,
  },
  spacer: { width: 38 },
  rightSlot: { width: 38, alignItems: "center", justifyContent: "center" },
});
