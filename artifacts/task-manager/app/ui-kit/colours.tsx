import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/components/ScreenHeader";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

function withOpacity(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Section label ─────────────────────────────────────────────────────────────
function SLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={s.sHead}>
      <Text style={s.sTitle}>{title}</Text>
      {sub ? <Text style={s.sSub}>{sub}</Text> : null}
    </View>
  );
}

// ── Copyable swatch ───────────────────────────────────────────────────────────
function Swatch({
  color,
  name,
  size = 56,
}: {
  color: string;
  name: string;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);

  const onPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Pressable onPress={onPress} style={[sw.wrap, { width: size + 24 }]}>
      <View
        style={[
          sw.block,
          { width: size, height: size, borderRadius: size * 0.22, backgroundColor: color },
        ]}
      />
      <Text style={sw.hex} numberOfLines={1}>
        {copied ? "Copied!" : color}
      </Text>
      <Text style={sw.name} numberOfLines={2}>
        {name}
      </Text>
    </Pressable>
  );
}

const sw = StyleSheet.create({
  wrap:  { alignItems: "center", gap: 5 },
  block: { borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  hex:   { color: Colors.textSecondary, fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0 },
  name:  { color: Colors.textMuted,     fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
});

// ── Tint scale row ────────────────────────────────────────────────────────────
const OPACITIES = [0.08, 0.15, 0.25, 0.4, 0.6, 0.8, 1];
const OPACITY_LABELS = ["8%","15%","25%","40%","60%","80%","100%"];

function TintRow({ color, name }: { color: string; name: string }) {
  return (
    <View style={tr.wrap}>
      <Text style={tr.label}>{name}</Text>
      <View style={tr.row}>
        {OPACITIES.map((o, i) => (
          <View key={i} style={tr.cell}>
            <View
              style={[
                tr.swatch,
                { backgroundColor: o === 1 ? color : withOpacity(color, o) },
              ]}
            />
            <Text style={tr.pct}>{OPACITY_LABELS[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const tr = StyleSheet.create({
  wrap:   { gap: 6, marginBottom: 14 },
  label:  { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
  row:    { flexDirection: "row", gap: 6 },
  cell:   { flex: 1, alignItems: "center", gap: 3 },
  swatch: { width: "100%", aspectRatio: 1, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  pct:    { color: Colors.textMuted, fontSize: 9, fontFamily: "Inter_400Regular" },
});

// ── Pill / tag preview ────────────────────────────────────────────────────────
function PillRow({ entries }: { entries: { label: string; color: string }[] }) {
  return (
    <View style={pr.row}>
      {entries.map(({ label, color }) => (
        <View key={label} style={[pr.pill, { backgroundColor: withOpacity(color, 0.15), borderColor: withOpacity(color, 0.4) }]}>
          <View style={[pr.dot, { backgroundColor: color }]} />
          <Text style={[pr.text, { color }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
const pr = StyleSheet.create({
  row:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

// ── In-context card preview ───────────────────────────────────────────────────
function ContextCard({ color, name }: { color: string; name: string }) {
  return (
    <View style={[cc.card, { borderColor: withOpacity(color, 0.3) }]}>
      {/* Accent bar */}
      <View style={[cc.bar, { backgroundColor: color }]} />
      <View style={cc.body}>
        {/* Header row */}
        <View style={cc.row}>
          <View style={[cc.dot, { backgroundColor: color }]} />
          <Text style={cc.heading} numberOfLines={1}>{name} task title example</Text>
        </View>
        {/* Sub row */}
        <View style={cc.row}>
          <Text style={cc.sub}>Status</Text>
          <View style={[cc.badge, { backgroundColor: withOpacity(color, 0.15), borderColor: withOpacity(color, 0.35) }]}>
            <Text style={[cc.badgeTx, { color }]}>{name}</Text>
          </View>
        </View>
        {/* Button */}
        <View style={cc.row}>
          <View style={[cc.btn, { backgroundColor: color }]}>
            <Text style={cc.btnTx}>Action</Text>
          </View>
          <View style={[cc.btnGhost, { borderColor: withOpacity(color, 0.5) }]}>
            <Text style={[cc.btnTx, { color }]}>Ghost</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
const cc = StyleSheet.create({
  card:   { backgroundColor: Colors.cardBg, borderRadius: 14, borderWidth: 1, overflow: "hidden", flexDirection: "row" },
  bar:    { width: 4 },
  body:   { flex: 1, padding: 12, gap: 8 },
  row:    { flexDirection: "row", alignItems: "center", gap: 8 },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  heading:{ flex: 1, color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sub:    { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" },
  badge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  badgeTx:{ fontSize: 11, fontFamily: "Inter_600SemiBold" },
  btn:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  btnGhost:{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  btnTx:  { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

// ── Background shade comparison ───────────────────────────────────────────────
const BG_SHADES = [
  { hex: "#000000", name: "Pure black" },
  { hex: "#0A0A0A", name: "black (current)" },
  { hex: "#111111", name: "darkBg (current)" },
  { hex: "#161616", name: "–" },
  { hex: "#1A1A1A", name: "cardBg (current)" },
  { hex: "#1F1F1F", name: "–" },
  { hex: "#222222", name: "elevated (current)" },
  { hex: "#272727", name: "–" },
  { hex: "#2A2A2A", name: "border (current)" },
  { hex: "#333333", name: "borderLight (current)" },
  { hex: "#404040", name: "–" },
  { hex: "#555555", name: "–" },
];

function BgShades() {
  return (
    <View style={bgs.outer}>
      {BG_SHADES.map(({ hex, name }) => (
        <View key={hex} style={[bgs.row, { backgroundColor: hex }]}>
          <Text style={bgs.hex}>{hex}</Text>
          <Text style={bgs.name}>{name}</Text>
        </View>
      ))}
    </View>
  );
}
const bgs = StyleSheet.create({
  outer: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11 },
  hex:   { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_500Medium" },
  name:  { color: "rgba(255,255,255,0.3)",  fontSize: 11, fontFamily: "Inter_400Regular" },
});

// ── Text contrast strip ───────────────────────────────────────────────────────
const TEXT_SHADES = [
  { hex: "#FFFFFF", label: "textPrimary (current)" },
  { hex: "#F0F0F0", label: "–" },
  { hex: "#E0E0E0", label: "–" },
  { hex: "#C8C8C8", label: "–" },
  { hex: "#A0A0A0", label: "textSecondary (current)" },
  { hex: "#888888", label: "–" },
  { hex: "#777777", label: "–" },
  { hex: "#666666", label: "textMuted (current)" },
  { hex: "#555555", label: "–" },
  { hex: "#444444", label: "–" },
];

function TextShades() {
  return (
    <View style={[bgs.outer, { backgroundColor: Colors.cardBg }]}>
      {TEXT_SHADES.map(({ hex, label }) => (
        <View key={hex} style={[bgs.row, { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
          <Text style={[bgs.hex, { color: hex, fontSize: 14, fontFamily: "Inter_600SemiBold" }]}>
            The quick brown fox
          </Text>
          <Text style={[bgs.name, { color: hex, minWidth: 50, textAlign: "right" }]}>{hex}</Text>
        </View>
      ))}
      <View style={[bgs.row]}>
        <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" }}>
          Each row = text on {Colors.cardBg} bg. Tap a shade name.
        </Text>
      </View>
    </View>
  );
}

// ── All named colours (current) ───────────────────────────────────────────────
const NAMED: { name: string; hex: string }[] = [
  { name: "primary",        hex: Colors.primary },
  { name: "primaryDark",    hex: Colors.primaryDark },
  { name: "primaryDim",     hex: Colors.primaryDim },
  { name: "success",        hex: Colors.success },
  { name: "warning",        hex: Colors.warning },
  { name: "info",           hex: Colors.info },
];

// ── Category status colours ───────────────────────────────────────────────────
const CATEGORY_ENTRIES = Object.entries(Colors.categories).map(([label, color]) => ({
  label,
  color,
}));

// ── Priority colours ──────────────────────────────────────────────────────────
const PRIORITY_ENTRIES = [
  { label: "Urgent", color: "#E03131" },
  { label: "High",   color: "#FD7E14" },
  { label: "Medium", color: "#FAB005" },
  { label: "Low",    color: "#40C057" },
];

// ── Alternative accent palettes to consider ───────────────────────────────────
const ALT_ACCENTS = [
  // reds
  { name: "Current primary",  hex: "#E03131" },
  { name: "Crimson softer",   hex: "#CC2222" },
  { name: "Vibrant red",      hex: "#FF3333" },
  { name: "Rose red",         hex: "#E8405A" },
  // oranges
  { name: "Warm amber",       hex: "#F76707" },
  { name: "Vivid orange",     hex: "#FF6900" },
  // yellows
  { name: "Golden yellow",    hex: "#FAB005" },
  { name: "Warm gold",        hex: "#E6AC00" },
  // greens
  { name: "Current success",  hex: "#40C057" },
  { name: "Emerald",          hex: "#2F9E44" },
  { name: "Mint",             hex: "#63E6BE" },
  // blues
  { name: "Current info",     hex: "#339AF0" },
  { name: "Cobalt",           hex: "#228BE6" },
  { name: "Indigo",           hex: "#4C6EF5" },
  { name: "Sky",              hex: "#74C0FC" },
  // purples
  { name: "Violet",           hex: "#9775FA" },
  { name: "Grape",            hex: "#CC5DE8" },
  // teals
  { name: "Teal",             hex: "#20C997" },
  { name: "Cyan",             hex: "#22D3EE" },
];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ColoursScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Colour Explorer" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: botPad + 60 }}
      >
        {/* ── 1. Current named colours ── */}
        <SLabel title="Current Accent Colours" sub="Tap any swatch to copy its hex code" />
        <View style={s.card}>
          <View style={s.swatchRow}>
            {NAMED.map(({ name, hex }) => (
              <Swatch key={name} color={hex} name={name} size={52} />
            ))}
          </View>
        </View>

        {/* ── 2. Tint / opacity scale ── */}
        <SLabel title="Tint Scales" sub="Each colour at 8 → 100% opacity on the app background" />
        <View style={s.card}>
          {NAMED.map(({ name, hex }) => (
            <TintRow key={name} color={hex} name={name} />
          ))}
        </View>

        {/* ── 3. Colours in context ── */}
        <SLabel title="Colours in Context" sub="See each accent as dot · badge · solid button · ghost button" />
        <View style={{ gap: 10 }}>
          {NAMED.map(({ name, hex }) => (
            <ContextCard key={name} color={hex} name={name} />
          ))}
        </View>

        {/* ── 4. Tag pills (current) ── */}
        <SLabel title="Status & Category Tags" sub="How current status / priority colours look as pills" />
        <View style={s.card}>
          <Text style={s.groupLabel}>Status</Text>
          <PillRow entries={CATEGORY_ENTRIES} />
          <View style={s.divider} />
          <Text style={s.groupLabel}>Priority</Text>
          <PillRow entries={PRIORITY_ENTRIES} />
        </View>

        {/* ── 5. Alternative accents to choose from ── */}
        <SLabel title="Alternative Accent Options" sub="Tap to copy — tell me which one you like and what to rename it" />
        <View style={s.card}>
          <View style={s.swatchRow}>
            {ALT_ACCENTS.map(({ name, hex }) => (
              <Swatch key={hex} color={hex} name={name} size={48} />
            ))}
          </View>
        </View>

        {/* ── 6. Background shades ── */}
        <SLabel title="Background Shades" sub="Current dark layer stack — from pure black to border" />
        <BgShades />

        {/* ── 7. Text contrast levels ── */}
        <SLabel title="Text Contrast Levels" sub="Same text rendered at different grey shades on card background" />
        <TextShades />

      </ScrollView>
    </View>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.darkBg },
  sHead:      { marginTop: 26, marginBottom: 10 },
  sTitle:     { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sSub:       { color: Colors.textMuted,   fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  card:       {
    backgroundColor: Colors.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 10,
  },
  swatchRow:  { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  groupLabel: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  divider:    { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
});
