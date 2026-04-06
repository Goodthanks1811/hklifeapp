import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/components/ScreenHeader";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

// ── Shared constants ──────────────────────────────────────────────────────────
const ITEM_H = 58;
const RED    = Colors.primary;

// ── Demo data ─────────────────────────────────────────────────────────────────
type Track = { id: string; emoji: string; label: string };

const SEEDS: Track[][] = [
  [
    { id: "a1", emoji: "🔥", label: "Submit quarterly report"     },
    { id: "a2", emoji: "📧", label: "Follow up with design team"  },
    { id: "a3", emoji: "💡", label: "Review new feature specs"    },
  ],
  [
    { id: "b1", emoji: "🚀", label: "Deploy to staging environment" },
    { id: "b2", emoji: "🧪", label: "Write unit tests for auth"     },
    { id: "b3", emoji: "📦", label: "Update npm dependencies"       },
  ],
  [
    { id: "c1", emoji: "🎯", label: "Set Q2 OKRs with manager"    },
    { id: "c2", emoji: "📝", label: "Document API endpoints"       },
    { id: "c3", emoji: "🔍", label: "Audit accessibility spec"     },
  ],
  [
    { id: "d1", emoji: "⚡", label: "Optimise slow DB queries"    },
    { id: "d2", emoji: "🎨", label: "Update brand colour tokens"  },
    { id: "d3", emoji: "🛡️", label: "Security review for v2.0"   },
  ],
  [
    { id: "e1", emoji: "📊", label: "Prepare board presentation"  },
    { id: "e2", emoji: "🤝", label: "Client onboarding call"       },
    { id: "e3", emoji: "🔧", label: "Fix iOS 26 keyboard bug"      },
  ],
];

// ── Collapse animation wrapper ────────────────────────────────────────────────
function CollapseRow({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  const h  = useRef(new Animated.Value(ITEM_H + 1)).current;
  const op = useRef(new Animated.Value(1)).current;

  const collapse = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(op, { toValue: 0, duration: 90,  useNativeDriver: false }),
      Animated.timing(h,  { toValue: 0, duration: 240, delay: 60, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(onRemove);
  }, [onRemove]);

  return (
    <Animated.View style={{ height: h, opacity: op, overflow: "hidden" }}>
      {React.cloneElement(children as React.ReactElement, { onDelete: collapse })}
    </Animated.View>
  );
}

// ── Base row ──────────────────────────────────────────────────────────────────
function Row({
  track,
  renderDelete,
  onDelete,
}: {
  track:        Track;
  renderDelete: (onDelete: () => void) => React.ReactNode;
  onDelete?:    () => void;
}) {
  const ref = useRef<Swipeable>(null);

  const del = useCallback(() => {
    ref.current?.close();
    onDelete?.();
  }, [onDelete]);

  const renderRight = useCallback(() => renderDelete(del), [del, renderDelete]);

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRight}
      overshootLeft={false}
      overshootRight={false}
      rightThreshold={28}
      friction={1.5}
      containerStyle={{ overflow: "hidden" }}
    >
      <View style={s.row}>
        <Text style={s.rowEmoji}>{track.emoji}</Text>
        <Text style={s.rowLabel} numberOfLines={1}>{track.label}</Text>
        <Feather name="music" size={13} color={Colors.textMuted} />
      </View>
    </Swipeable>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function Section({
  n, title, sub,
}: { n: string; title: string; sub: string }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.badge}>
        <Text style={s.badgeText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionSub}>{sub}</Text>
      </View>
    </View>
  );
}

function Empty({ onReset }: { onReset: () => void }) {
  return (
    <View style={s.empty}>
      <Feather name="check" size={16} color={Colors.success} />
      <Text style={s.emptyTx}>All cleared</Text>
      <Pressable style={s.resetBtn} onPress={onReset}>
        <Text style={s.resetTx}>Reset</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE BUTTON DESIGNS
// ─────────────────────────────────────────────────────────────────────────────

// 1 · Current — full red slab, icon + label
const renderCurrent = (onDelete: () => void) => (
  <Pressable style={d.current} onPress={onDelete}>
    <Feather name="trash-2" size={16} color="#fff" />
    <Text style={d.currentTx}>Delete</Text>
  </Pressable>
);

// 2 · Icon-only square — tight, no text, minimal
const renderIconOnly = (onDelete: () => void) => (
  <Pressable style={d.iconOnly} onPress={onDelete}>
    <Feather name="trash-2" size={20} color="#fff" />
  </Pressable>
);

// 3 · Dark ghost — dark BG, red-bordered square with red icon
const renderGhost = (onDelete: () => void) => (
  <Pressable style={d.ghost} onPress={onDelete}>
    <Feather name="trash-2" size={18} color={RED} />
  </Pressable>
);

// 4 · Wide label — wider panel, no icon, big "Delete" text only
const renderWide = (onDelete: () => void) => (
  <Pressable style={d.wide} onPress={onDelete}>
    <Text style={d.wideTx}>Delete</Text>
  </Pressable>
);

// 5 · Split — two zones: a dark icon block + a red text block
const renderSplit = (onDelete: () => void) => (
  <View style={d.split}>
    <View style={d.splitIcon}>
      <Feather name="trash-2" size={16} color={RED} />
    </View>
    <Pressable style={d.splitLabel} onPress={onDelete}>
      <Text style={d.splitTx}>Delete</Text>
    </Pressable>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SwipeDeleteScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [lists, setLists] = useState<Track[][]>(SEEDS.map(s => [...s]));

  const remove = (setIdx: number, id: string) =>
    setLists(prev => prev.map((l, i) => i === setIdx ? l.filter(t => t.id !== id) : l));

  const reset  = (setIdx: number) =>
    setLists(prev => prev.map((l, i) => i === setIdx ? [...SEEDS[setIdx]] : l));

  const designs = [
    { render: renderCurrent,  title: "Current  ·  Red slab + icon + label",         sub: "110px wide, full red, icon left of text" },
    { render: renderIconOnly, title: "Icon only  ·  Square",                         sub: "72px wide, just the trash icon centred" },
    { render: renderGhost,    title: "Ghost  ·  Dark BG + red border",               sub: "72px wide, transparent red-bordered square" },
    { render: renderWide,     title: "Wide label  ·  No icon",                       sub: "120px wide, bold Delete text only" },
    { render: renderSplit,    title: "Split  ·  Dark icon block + red label block",  sub: "Two zones: icon on left, Delete on right" },
  ];

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Swipe Delete Styles" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {designs.map((design, si) => (
          <React.Fragment key={si}>
            <Section n={String(si + 1)} title={design.title} sub={design.sub} />
            <View style={s.card}>
              {lists[si].length === 0 ? (
                <Empty onReset={() => reset(si)} />
              ) : (
                lists[si].map((track, ti) => (
                  <CollapseRow
                    key={track.id}
                    onRemove={() => remove(si, track.id)}
                  >
                    <Row
                      track={track}
                      renderDelete={design.render}
                    />
                  </CollapseRow>
                ))
              )}
            </View>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },

  sectionHead: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    marginTop: 28, marginBottom: 10,
  },
  badge: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: `${RED}22`, borderWidth: 1, borderColor: `${RED}55`,
    alignItems: "center", justifyContent: "center",
  },
  badgeText:    { color: RED,                fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionTitle: { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionSub:   { color: Colors.textMuted,   fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  card: {
    backgroundColor: Colors.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },

  row: {
    height: ITEM_H,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0f0f0f",
    paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowEmoji: { fontSize: 19 },
  rowLabel: {
    flex: 1, color: Colors.textPrimary,
    fontSize: 13, fontFamily: "Inter_400Regular",
  },

  empty: { alignItems: "center", paddingVertical: 22, gap: 8 },
  emptyTx:  { color: Colors.textMuted, fontSize: 13, fontFamily: "Inter_500Medium" },
  resetBtn: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  resetTx: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
});

// Delete button visual styles
const d = StyleSheet.create({
  // 1 · Current
  current: {
    width: 110, height: ITEM_H,
    backgroundColor: RED,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
  },
  currentTx: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // 2 · Icon only
  iconOnly: {
    width: 72, height: ITEM_H,
    backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
  },

  // 3 · Ghost
  ghost: {
    width: 72, height: ITEM_H,
    backgroundColor: "#140808",
    borderLeftWidth: 1, borderLeftColor: `${RED}60`,
    alignItems: "center", justifyContent: "center",
  },

  // 4 · Wide label only
  wide: {
    width: 120, height: ITEM_H,
    backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
  },
  wideTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },

  // 5 · Split
  split: {
    flexDirection: "row", height: ITEM_H,
  },
  splitIcon: {
    width: 52, height: ITEM_H,
    backgroundColor: "#140808",
    borderLeftWidth: 1, borderLeftColor: `${RED}40`,
    alignItems: "center", justifyContent: "center",
  },
  splitLabel: {
    width: 72, height: ITEM_H,
    backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
  },
  splitTx: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
