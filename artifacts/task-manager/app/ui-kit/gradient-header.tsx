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

function MiniHeader() {
  return (
    <View style={s.miniHeader}>
      <View style={s.menuBtn}>
        <Feather name="menu" size={16} color={Colors.textPrimary} />
      </View>
      <Text style={s.miniTitle}>Life Admin</Text>
      <View style={s.menuBtn}>
        <Feather name="refresh-cw" size={14} color={Colors.textMuted} />
      </View>
    </View>
  );
}

function MiniCountRow() {
  return (
    <View style={s.countRow}>
      <Text style={s.countText}>{ROWS.length} items</Text>
    </View>
  );
}

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
        {/* Description */}
        <Text style={s.description}>
          A subtle red gradient above the list items gives each Life section a
          visual anchor and pushes items down for more breathing room.
        </Text>

        {/* ── Current ── */}
        <SectionDivider label="Current" />
        <View style={s.card}>
          <MiniHeader />
          <MiniCountRow />
          <View style={s.listArea}>
            {ROWS.map((r, i) => <MiniRow key={i} {...r} />)}
          </View>
        </View>

        {/* ── Proposed ── */}
        <SectionDivider label="Proposed" />
        <View style={s.card}>
          <MiniHeader />
          <MiniCountRow />
          <View style={s.listArea}>
            {/* Gradient overlay */}
            <LinearGradient
              colors={["rgba(224,49,49,0.28)", "transparent"]}
              style={s.gradient}
            />
            {/* Items pushed down below the gradient */}
            <View style={{ paddingTop: 70 }}>
              {ROWS.map((r, i) => <MiniRow key={i} {...r} />)}
            </View>
          </View>
        </View>

        {/* Spec note */}
        <View style={s.specCard}>
          <Text style={s.specTitle}>Spec</Text>
          <View style={s.specRow}>
            <Text style={s.specKey}>Gradient</Text>
            <Text style={s.specVal}>rgba(224,49,49, 0.28) → transparent</Text>
          </View>
          <View style={s.specRow}>
            <Text style={s.specKey}>Height</Text>
            <Text style={s.specVal}>70 px</Text>
          </View>
          <View style={s.specRow}>
            <Text style={s.specKey}>Item offset</Text>
            <Text style={s.specVal}>paddingTop: 70</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.darkBg },
  scroll: { padding: 20, gap: 0 },

  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    marginTop: 4,
    marginBottom: 4,
  },

  divider: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 24, marginBottom: 14,
  },
  dividerLine:  { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerLabel: {
    color: Colors.textMuted, fontSize: 11,
    fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase",
  },

  card: {
    backgroundColor: Colors.darkBg,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    overflow: "hidden",
  },

  miniHeader: {
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

  countRow: { paddingHorizontal: 14, paddingVertical: 6 },
  countText: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_500Medium" },

  listArea: { position: "relative", marginHorizontal: 14, marginTop: 6, marginBottom: 10 },

  gradient: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 70, zIndex: 1,
  },

  row: {
    height: ITEM_H,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 1,
  },
  emoji:    { fontSize: 20, minWidth: 26, textAlign: "center" },
  rowTitle: {
    flex: 1, color: Colors.textPrimary, fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  pill: {
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  pillText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: "#5a5a5a",
  },

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
  specRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  specKey: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },
  specVal: { color: Colors.textPrimary,   fontSize: 13, fontFamily: "Inter_400Regular" },
});
