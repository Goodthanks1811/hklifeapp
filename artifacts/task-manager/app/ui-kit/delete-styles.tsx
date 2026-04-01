import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/components/ScreenHeader";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

// ── Demo data ─────────────────────────────────────────────────────────────────
type Task = { id: string; emoji: string; label: string };

const SEED_A: Task[] = [
  { id: "a1", emoji: "🔥", label: "Submit quarterly report"     },
  { id: "a2", emoji: "📧", label: "Follow up with design team"  },
  { id: "a3", emoji: "💡", label: "Review new feature specs"    },
];
const SEED_B: Task[] = [
  { id: "b1", emoji: "🚀", label: "Deploy to staging environment" },
  { id: "b2", emoji: "🧪", label: "Write unit tests for auth"     },
  { id: "b3", emoji: "📦", label: "Update npm dependencies"       },
];
const SEED_C: Task[] = [
  { id: "c1", emoji: "🎯", label: "Set Q2 OKRs with manager"    },
  { id: "c2", emoji: "📝", label: "Document API endpoints"       },
  { id: "c3", emoji: "🔍", label: "Audit accessibility spec"     },
];
const SEED_D: Task[] = [
  { id: "d1", emoji: "⚡", label: "Optimise slow DB queries"    },
  { id: "d2", emoji: "🎨", label: "Update brand colour tokens"  },
  { id: "d3", emoji: "🛡️", label: "Security review for v2.0"   },
];
const SEED_E: Task[] = [
  { id: "e1", emoji: "📊", label: "Prepare board presentation"  },
  { id: "e2", emoji: "🤝", label: "Client onboarding call"       },
  { id: "e3", emoji: "🔧", label: "Fix iOS 26 keyboard bug"      },
];

// ── Animated collapse wrapper ─────────────────────────────────────────────────
function CollapseRow({ onRemove, render }: {
  onRemove: () => void;
  render: (onCollapse: () => void) => React.ReactNode;
}) {
  const h  = useRef(new Animated.Value(62)).current;
  const op = useRef(new Animated.Value(1)).current;
  const mb = useRef(new Animated.Value(1)).current;

  const collapse = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(op, { toValue: 0, duration: 100, useNativeDriver: false }),
      Animated.timing(h,  { toValue: 0, duration: 260, delay: 60, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(mb, { toValue: 0, duration: 260, delay: 60, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(onRemove);
  }, [onRemove]);

  return (
    <Animated.View style={{ height: h, opacity: op, marginBottom: mb, overflow: "hidden" }}>
      {render(collapse)}
    </Animated.View>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function Section({ n, title, sub }: { n: string; title: string; sub: string }) {
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
    <View style={s.emptyState}>
      <Feather name="check" size={18} color={Colors.success} />
      <Text style={s.emptyText}>All cleared</Text>
      <Pressable style={s.resetBtn} onPress={onReset}>
        <Text style={s.resetBtnText}>Reset</Text>
      </Pressable>
    </View>
  );
}

// ── Style 1 · Swipe → Red Pill ────────────────────────────────────────────────
function PillRow({ task, onCollapse }: { task: Task; onCollapse: () => void }) {
  const tx  = useRef(new Animated.Value(0)).current;
  const ref = useRef(false);

  const pillOp = tx.interpolate({ inputRange: [-110, -30, 0], outputRange: [1, 0.1, 0], extrapolate: "clamp" });
  const pillTx = tx.interpolate({ inputRange: [-110, 0], outputRange: [0, 14], extrapolate: "clamp" });
  const snap   = () => Animated.spring(tx, { toValue: 0, useNativeDriver: false, tension: 160, friction: 14 }).start();
  const del    = () => { if (ref.current) return; ref.current = true; onCollapse(); };

  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove:   (_, g) => tx.setValue(Math.min(0, Math.max(-110, g.dx))),
    onPanResponderRelease:(_, g) => g.dx < -70 ? del() : snap(),
    onPanResponderTerminate: snap,
  });

  return (
    <View style={s.rowWrap}>
      <View style={s.swipeBg}>
        <Animated.View style={{ opacity: pillOp, transform: [{ translateX: pillTx }] }}>
          <Pressable style={s.redPill} onPress={del}>
            <Feather name="trash-2" size={12} color="#fff" />
            <Text style={s.redPillTx}>Delete</Text>
          </Pressable>
        </Animated.View>
      </View>
      <Animated.View style={[s.fg, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <Text style={s.emoji}>{task.emoji}</Text>
        <Text style={s.label} numberOfLines={1}>{task.label}</Text>
      </Animated.View>
    </View>
  );
}

// ── Style 2 · Swipe → Full Red Background ─────────────────────────────────────
function FullRedRow({ task, onCollapse }: { task: Task; onCollapse: () => void }) {
  const tx  = useRef(new Animated.Value(0)).current;
  const ref = useRef(false);

  const bgOp   = tx.interpolate({ inputRange: [-90, 0], outputRange: [1, 0], extrapolate: "clamp" });
  const iconTx = tx.interpolate({ inputRange: [-90, 0], outputRange: [0, 20], extrapolate: "clamp" });
  const snap   = () => Animated.spring(tx, { toValue: 0, useNativeDriver: false, tension: 160, friction: 14 }).start();
  const del    = () => { if (ref.current) return; ref.current = true; onCollapse(); };

  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove:   (_, g) => tx.setValue(Math.min(0, Math.max(-90, g.dx))),
    onPanResponderRelease:(_, g) => g.dx < -60 ? del() : snap(),
    onPanResponderTerminate: snap,
  });

  return (
    <View style={s.rowWrap}>
      <Animated.View style={[StyleSheet.absoluteFill, {
        backgroundColor: Colors.primary, opacity: bgOp,
        alignItems: "flex-end", justifyContent: "center", paddingRight: 18,
      }]}>
        <Animated.View style={{ transform: [{ translateX: iconTx }] }}>
          <Feather name="trash-2" size={18} color="#fff" />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[s.fg, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <Text style={s.emoji}>{task.emoji}</Text>
        <Text style={s.label} numberOfLines={1}>{task.label}</Text>
      </Animated.View>
    </View>
  );
}

// ── Style 3 · Tap → Inline Confirm ───────────────────────────────────────────
function InlineConfirmRow({ task, onCollapse }: { task: Task; onCollapse: () => void }) {
  const [mode, setMode] = useState<"normal" | "confirm">("normal");
  const anim = useRef(new Animated.Value(0)).current;

  const showConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode("confirm");
    Animated.spring(anim, { toValue: 1, useNativeDriver: false, tension: 200, friction: 16 }).start();
  };
  const hideConfirm = () => {
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: false }).start(() => setMode("normal"));
  };

  const normalOp  = anim.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: "clamp" });
  const confirmOp = anim.interpolate({ inputRange: [0.55, 1], outputRange: [0, 1], extrapolate: "clamp" });

  return (
    <View style={s.rowWrap}>
      <Animated.View style={[s.inlineRow, { opacity: normalOp, position: mode === "confirm" ? "absolute" : "relative", top: 0, left: 0, right: 0 }]}
        pointerEvents={mode === "confirm" ? "none" : "auto"}>
        <Text style={s.emoji}>{task.emoji}</Text>
        <Text style={s.label} numberOfLines={1}>{task.label}</Text>
        <Pressable style={s.trashBtn} onPress={showConfirm}>
          <Feather name="trash-2" size={15} color={Colors.textMuted} />
        </Pressable>
      </Animated.View>

      {mode === "confirm" && (
        <Animated.View style={[s.inlineRow, s.confirmBg, { opacity: confirmOp }]}>
          <Feather name="alert-circle" size={14} color={Colors.primary} />
          <Text style={s.confirmTx}>Delete this task?</Text>
          <Pressable style={s.ghostBtn} onPress={hideConfirm}>
            <Text style={s.ghostBtnTx}>Cancel</Text>
          </Pressable>
          <Pressable style={s.redSolidBtn} onPress={onCollapse}>
            <Text style={s.redSolidBtnTx}>Delete</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// ── Style 4 · Always-visible Trash Badge ──────────────────────────────────────
function TrashBadgeRow({ task, onCollapse }: { task: Task; onCollapse: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const del = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 70, useNativeDriver: false }),
      Animated.timing(scale, { toValue: 0,   duration: 100, useNativeDriver: false }),
    ]).start(onCollapse);
  };

  return (
    <View style={s.rowWrap}>
      <View style={s.inlineRow}>
        <Text style={s.emoji}>{task.emoji}</Text>
        <Text style={s.label} numberOfLines={1}>{task.label}</Text>
        <Pressable onPress={del} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Animated.View style={[s.trashBadge, { transform: [{ scale }] }]}>
            <Feather name="trash-2" size={13} color={Colors.primary} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

// ── Style 5 · Long-press Batch Select ─────────────────────────────────────────
function BatchSelectSection() {
  const [items,      setItems]      = useState<Task[]>(SEED_E);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const barAnim = useRef(new Animated.Value(0)).current;

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const enter = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    setSelected(new Set([id]));
    Animated.spring(barAnim, { toValue: 1, useNativeDriver: false, tension: 200, friction: 16 }).start();
  };

  const cancel = () => {
    setSelectMode(false);
    setSelected(new Set());
    Animated.timing(barAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const deleteSelected = () => {
    setItems(prev => prev.filter(t => !selected.has(t.id)));
    setSelected(new Set());
    setSelectMode(false);
    Animated.timing(barAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const barH = barAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 54] });

  if (items.length === 0) {
    return (
      <View style={s.card}>
        <Empty onReset={() => { setItems(SEED_E); setSelectMode(false); setSelected(new Set()); }} />
      </View>
    );
  }

  return (
    <View style={s.card}>
      {items.map((task, i) => {
        const checked = selected.has(task.id);
        return (
          <Pressable
            key={task.id}
            style={[s.inlineRow, i < items.length - 1 && s.rowDivider]}
            onPress={() => selectMode ? toggle(task.id) : undefined}
            onLongPress={() => !selectMode && enter(task.id)}
          >
            {selectMode && (
              <Pressable onPress={() => toggle(task.id)} style={[s.checkbox, checked && s.checkboxOn]}>
                {checked && <Feather name="check" size={10} color="#fff" />}
              </Pressable>
            )}
            <Text style={s.emoji}>{task.emoji}</Text>
            <Text style={[s.label, checked && s.labelDone]} numberOfLines={1}>{task.label}</Text>
          </Pressable>
        );
      })}
      <Animated.View style={{ height: barH, overflow: "hidden", borderTopWidth: 1, borderTopColor: Colors.border }}>
        <View style={s.selectBar}>
          <Pressable style={s.ghostBtn} onPress={cancel}>
            <Text style={s.ghostBtnTx}>Cancel</Text>
          </Pressable>
          <Text style={s.selectCount}>{selected.size} selected</Text>
          <Pressable style={[s.redSolidBtn, selected.size === 0 && { opacity: 0.4 }]} onPress={deleteSelected} disabled={selected.size === 0}>
            <Feather name="trash-2" size={12} color="#fff" />
            <Text style={s.redSolidBtnTx}>Delete</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function DeleteStylesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [aItems, setAItems] = useState<Task[]>(SEED_A);
  const [bItems, setBItems] = useState<Task[]>(SEED_B);
  const [cItems, setCItems] = useState<Task[]>(SEED_C);
  const [dItems, setDItems] = useState<Task[]>(SEED_D);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ScreenHeader title="Delete Styles" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1 · Swipe → Red Pill */}
        <Section n="1" title="Swipe → Red Pill" sub="Swipe left to reveal a pill — tap it to confirm" />
        <View style={s.card}>
          {aItems.length === 0
            ? <Empty onReset={() => setAItems(SEED_A)} />
            : aItems.map(task => (
                <CollapseRow
                  key={task.id}
                  onRemove={() => setAItems(p => p.filter(t => t.id !== task.id))}
                  render={fn => <PillRow task={task} onCollapse={fn} />}
                />
              ))}
        </View>

        {/* 2 · Swipe → Full Red */}
        <Section n="2" title="Swipe → Full Red BG" sub="Swipe left — the whole background turns red" />
        <View style={s.card}>
          {bItems.length === 0
            ? <Empty onReset={() => setBItems(SEED_B)} />
            : bItems.map(task => (
                <CollapseRow
                  key={task.id}
                  onRemove={() => setBItems(p => p.filter(t => t.id !== task.id))}
                  render={fn => <FullRedRow task={task} onCollapse={fn} />}
                />
              ))}
        </View>

        {/* 3 · Inline Confirm */}
        <Section n="3" title="Inline Confirm" sub="Tap 🗑 — row flips to show Cancel / Delete" />
        <View style={s.card}>
          {cItems.length === 0
            ? <Empty onReset={() => setCItems(SEED_C)} />
            : cItems.map(task => (
                <CollapseRow
                  key={task.id}
                  onRemove={() => setCItems(p => p.filter(t => t.id !== task.id))}
                  render={fn => <InlineConfirmRow task={task} onCollapse={fn} />}
                />
              ))}
        </View>

        {/* 4 · Visible Trash Badge */}
        <Section n="4" title="Visible Trash Badge" sub="Always-on badge — tap it, pops and collapses instantly" />
        <View style={s.card}>
          {dItems.length === 0
            ? <Empty onReset={() => setDItems(SEED_D)} />
            : dItems.map(task => (
                <CollapseRow
                  key={task.id}
                  onRemove={() => setDItems(p => p.filter(t => t.id !== task.id))}
                  render={fn => <TrashBadgeRow task={task} onCollapse={fn} />}
                />
              ))}
        </View>

        {/* 5 · Batch Select */}
        <Section n="5" title="Long-press → Batch Select" sub="Long-press any row, check items, delete all at once" />
        <BatchSelectSection />

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },

  sectionHead: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    marginTop: 28, marginBottom: 10,
  },
  badge: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: `${Colors.primary}22`,
    borderWidth: 1, borderColor: `${Colors.primary}55`,
    alignItems: "center", justifyContent: "center",
  },
  badgeText:    { color: Colors.primary, fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionTitle: { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionSub:   { color: Colors.textMuted,   fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  card: {
    backgroundColor: Colors.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },

  // ── Row base ─────────────────────────────────────────────────────────────
  rowWrap:  { height: 62, overflow: "hidden" },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  swipeBg:  {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.darkBg,
    alignItems: "flex-end", justifyContent: "center", paddingRight: 14,
  },
  fg: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.cardBg, paddingHorizontal: 14, gap: 12,
  },
  inlineRow: {
    height: 62, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, gap: 12, backgroundColor: Colors.cardBg,
  },
  emoji: { fontSize: 20 },
  label: {
    flex: 1, color: Colors.textPrimary,
    fontSize: 13, fontFamily: "Inter_400Regular",
  },
  labelDone: { color: Colors.textMuted, textDecorationLine: "line-through" },

  // ── Style 1 ───────────────────────────────────────────────────────────────
  redPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary, borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  redPillTx: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // ── Style 3 ───────────────────────────────────────────────────────────────
  trashBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  confirmBg: { backgroundColor: `${Colors.primary}12`, gap: 8, paddingHorizontal: 12 },
  confirmTx: { flex: 1, color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular" },

  // ── Style 4 ───────────────────────────────────────────────────────────────
  trashBadge: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: `${Colors.primary}18`,
    borderWidth: 1, borderColor: `${Colors.primary}44`,
    alignItems: "center", justifyContent: "center",
  },

  // ── Style 5 ───────────────────────────────────────────────────────────────
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selectBar: {
    height: 54, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, gap: 10,
  },
  selectCount: {
    flex: 1, textAlign: "center",
    color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium",
  },

  // ── Shared buttons ────────────────────────────────────────────────────────
  ghostBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  ghostBtnTx: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
  redSolidBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, backgroundColor: Colors.primary,
  },
  redSolidBtnTx: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText:  { color: Colors.textMuted, fontSize: 13, fontFamily: "Inter_500Medium" },
  resetBtn: {
    paddingHorizontal: 18, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  resetBtnText: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
});
