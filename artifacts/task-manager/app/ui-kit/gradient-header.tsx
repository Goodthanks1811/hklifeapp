import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenHeader } from "@/components/ScreenHeader";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

const ROWS = [
  { emoji: "🏠", title: "Pay rent",             status: "In Progress", sc: Colors.warning  },
  { emoji: "📋", title: "Insurance renewal",     status: "Not started", sc: "#555555"       },
  { emoji: "🔑", title: "Book locksmith",        status: "Done",        sc: Colors.success  },
  { emoji: "📦", title: "Return Amazon package", status: "Backlog",     sc: Colors.info     },
  { emoji: "💳", title: "Credit card statement", status: "Not started", sc: "#555555"       },
  { emoji: "🚗", title: "Car service booking",   status: "In Progress", sc: Colors.warning  },
];

const ITEM_H = 48;

function MiniRow({ emoji, title, status, sc }: typeof ROWS[0]) {
  return (
    <View style={s.row}>
      <Text style={s.emoji}>{emoji}</Text>
      <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
      <View style={[s.pill, { backgroundColor: sc + "28", borderColor: sc + "55" }]}>
        <Text style={[s.pillText, { color: sc }]}>{status}</Text>
      </View>
      <View style={s.checkbox} />
    </View>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <View style={s.divider}>
      <View style={s.dividerLine} />
      <Text style={s.dividerLabel}>{label}</Text>
      <View style={s.dividerLine} />
    </View>
  );
}

// Current — normal header with border, items start below it
function CurrentPreview() {
  return (
    <View style={s.card}>
      {/* Exact ScreenHeader replica */}
      <View style={s.currentHeader}>
        <View style={s.menuBtn}>
          <Feather name="menu" size={16} color={Colors.textPrimary} />
        </View>
        <Text style={s.miniTitle}>Life Admin</Text>
        <View style={s.menuBtn}>
          <Feather name="refresh-cw" size={13} color={Colors.textMuted} />
        </View>
      </View>
      <View style={s.countRow}>
        <Text style={s.countText}>{ROWS.length} items</Text>
      </View>
      <View style={s.listArea}>
        {ROWS.map((r, i) => <MiniRow key={i} {...r} />)}
      </View>
    </View>
  );
}

// Proposed — Spotify-style: title floats over black→dark-crimson glow, no separator
function ProposedPreview() {
  return (
    <View style={s.card}>
      {/* Hero gradient area — title + buttons overlay it */}
      <View style={s.heroOuter}>
        {/* Main gradient: black → dark crimson → transparent */}
        <LinearGradient
          colors={["#000000", "rgba(100,0,0,0.72)", "rgba(40,0,0,0.25)", "transparent"]}
          locations={[0, 0.28, 0.58, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Header row: burger + spacer (no border, no bg) */}
        <View style={s.heroNav}>
          <View style={s.menuBtnGhost}>
            <Feather name="menu" size={16} color={Colors.textPrimary} />
          </View>
          <View style={{ flex: 1 }} />
          <View style={s.menuBtnGhost}>
            <Feather name="refresh-cw" size={13} color={Colors.textMuted} />
          </View>
        </View>
        {/* Title sits in lower half of the hero */}
        <Text style={s.heroTitle}>Life Admin</Text>
      </View>

      {/* Count — no separator above, blends right in */}
      <View style={s.countRow}>
        <Text style={s.countText}>{ROWS.length} items</Text>
      </View>
      <View style={s.listArea}>
        {ROWS.map((r, i) => <MiniRow key={i} {...r} />)}
      </View>
    </View>
  );
}

export default function GradientHeaderScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Gradient Header" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: botPad + 24 }]}
      >
        <Text style={s.description}>
          Title and nav float over a black → dark crimson glow. No header border — the top blends seamlessly into the list.
        </Text>

        <SectionDivider label="Current" />
        <CurrentPreview />

        <SectionDivider label="Proposed" />
        <ProposedPreview />

        {/* Spec */}
        <View style={s.specCard}>
          <Text style={s.specTitle}>Spec</Text>
          <View style={s.specRow}>
            <Text style={s.specKey}>Gradient</Text>
            <Text style={s.specVal}>#000 → rgba(100,0,0,0.72) → transparent</Text>
          </View>
          <View style={s.specRow}>
            <Text style={s.specKey}>Hero height</Text>
            <Text style={s.specVal}>~100 px</Text>
          </View>
          <View style={s.specRow}>
            <Text style={s.specKey}>Header border</Text>
            <Text style={s.specVal}>Removed</Text>
          </View>
          <View style={s.specRow}>
            <Text style={s.specKey}>Title position</Text>
            <Text style={s.specVal}>Overlays gradient (bottom of hero)</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.darkBg },
  scroll: { padding: 20 },

  description: {
    color: Colors.textSecondary, fontSize: 14,
    fontFamily: "Inter_400Regular", lineHeight: 21,
    marginTop: 4, marginBottom: 4,
  },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 14 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerLabel: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase" },

  card: {
    backgroundColor: Colors.darkBg,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    overflow: "hidden",
  },

  // ── Current header (exact ScreenHeader style) ──
  currentHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10, gap: 12,
    backgroundColor: Colors.darkBg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuBtn: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: Colors.cardBg,
    alignItems: "center", justifyContent: "center",
  },
  miniTitle: {
    flex: 1, textAlign: "center",
    color: Colors.textPrimary, fontSize: 15,
    fontFamily: "Inter_700Bold", letterSpacing: 0.1,
  },

  // ── Proposed hero ──
  heroOuter: {
    height: 100,
    backgroundColor: "#000",
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  heroNav: {
    position: "absolute", top: 8, left: 10, right: 10,
    flexDirection: "row", alignItems: "center",
  },
  menuBtnGhost: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: "rgba(26,26,26,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  heroTitle: {
    textAlign: "center",
    color: Colors.textPrimary, fontSize: 15,
    fontFamily: "Inter_700Bold", letterSpacing: 0.1,
  },

  // ── Shared list ──
  countRow: { paddingHorizontal: 14, paddingVertical: 6 },
  countText: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_500Medium" },

  listArea: { marginHorizontal: 14, marginBottom: 10, gap: 1 },

  row: {
    height: ITEM_H, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, borderRadius: 8,
  },
  emoji:    { fontSize: 19, minWidth: 24, textAlign: "center" },
  rowTitle: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pill:     { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: "#5a5a5a" },

  // ── Spec ──
  specCard: {
    marginTop: 24,
    backgroundColor: Colors.cardBg,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 8,
  },
  specTitle: {
    color: Colors.textMuted, fontSize: 10,
    fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase",
    marginBottom: 2,
  },
  specRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 },
  specKey: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },
  specVal: { color: Colors.textPrimary,   fontSize: 12, fontFamily: "Inter_400Regular", flexShrink: 1, textAlign: "right" },
});
