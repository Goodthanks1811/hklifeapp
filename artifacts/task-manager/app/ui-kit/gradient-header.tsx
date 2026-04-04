import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { useDrawer } from "@/context/DrawerContext";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG = "#0f0f0f";

const ITEMS = [
  { emoji: "🔥", title: "Check suncorp origin",                          done: false },
  { emoji: "🔥", title: "Video for Suegra",                              done: false },
  { emoji: "🔥", title: "Make Tyga Playlist",                            done: false },
  { emoji: "🔥", title: "Think about weekly reflection",                 done: false },
  { emoji: "🔥", title: "Make appointment with myself",                  done: false },
  { emoji: "🖥", title: "Recommence Spanish Lessons",                    done: false },
  { emoji: "🖥", title: "Book laser",                                     done: false },
  { emoji: "🖥", title: "GP check Alice",                                done: false },
  { emoji: "🖥", title: "Email Alice with weekly check in 🧠",           done: true  },
  { emoji: "🖥", title: "Cancel subscriptions",                          done: false },
  { emoji: "🖥", title: "Danny GPT Instructions",                        done: true  },
  { emoji: "🖥", title: "Research new running shoes",                    done: false },
  { emoji: "🖥", title: "Sort tax documents",                            done: true  },
];

function Row({ emoji, title, done }: typeof ITEMS[0]) {
  return (
    <View style={s.row}>
      <View style={s.pill}>
        <Text style={s.pillEmoji}>{emoji}</Text>
      </View>
      <Text style={[s.rowTitle, done && s.rowDone]} numberOfLines={1}>{title}</Text>
      <View style={[s.chk, done && s.chkOn]}>
        {done && <Text style={s.chkTick}>✓</Text>}
      </View>
    </View>
  );
}

export default function GradientHeaderScreen() {
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();
  const doneCount = ITEMS.filter(i => i.done).length;

  return (
    <View style={s.root}>

      {/* ── Gradient header ───────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        {/* Multi-radial approximation with two LinearGradient layers */}
        <LinearGradient
          colors={["rgba(224,49,49,0.72)", "rgba(180,20,20,0.28)", "transparent"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Corner glows via a wide low-opacity overlay */}
        <LinearGradient
          colors={["rgba(224,49,49,0.22)", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Nav row: back + refresh */}
        <View style={s.navRow}>
          <TouchableOpacity style={s.iconBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleDrawer(); }} hitSlop={8}>
            <Feather name="menu" size={18} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={s.iconBtnGhost} hitSlop={8}>
            <Feather name="refresh-cw" size={14} color="rgba(255,255,255,0.28)" />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={s.title}>Gradient Header</Text>
        {/* Subtitle */}
        <Text style={s.subtitle}>{doneCount} done · {ITEMS.length} items</Text>
      </View>

      {/* ── List ─────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {ITEMS.map((item, i) => <Row key={i} {...item} />)}
      </ScrollView>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingBottom: 56,
    overflow: "hidden",
  },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(26,26,26,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  iconBtnGhost: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },

  title: {
    fontSize: 20, fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(224,49,49,0.45)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 13,
  },
  pill: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "rgba(224,49,49,0.12)",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  pillEmoji: { fontSize: 15 },

  rowTitle: {
    flex: 1,
    fontSize: 15,
    color: "rgba(255,255,255,0.82)",
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  rowDone: {
    color: "rgba(255,255,255,0.22)",
    textDecorationLine: "line-through",
  },

  chk: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  chkOn: {
    backgroundColor: "#E03131",
    borderColor: "#E03131",
  },
  chkTick: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
