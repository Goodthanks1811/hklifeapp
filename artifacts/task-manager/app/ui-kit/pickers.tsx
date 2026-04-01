import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/components/ScreenHeader";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

// ── Constants ─────────────────────────────────────────────────────────────────
const ITEM_H     = 46;
const VISIBLE    = 5;
const DRUM_H     = ITEM_H * VISIBLE;

const MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS    = Array.from({ length: 31 }, (_, i) => String(i + 1));
const YEARS   = Array.from({ length: 12 }, (_, i) => String(2024 + i));
const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPM    = ["AM", "PM"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionLabel({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <View style={s.sectionHead}>
      <View style={s.badge}><Text style={s.badgeText}>{n}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionSub}>{sub}</Text>
      </View>
    </View>
  );
}

// ── Scroll-wheel drum picker ──────────────────────────────────────────────────
function DrumPicker({
  items,
  selectedIndex,
  onChange,
  width = 90,
}: {
  items:         string[];
  selectedIndex: number;
  onChange:      (i: number) => void;
  width?:        number;
}) {
  const ref       = useRef<ScrollView>(null);
  const isDragging = useRef(false);

  const scrollTo = useCallback((i: number, animated = true) => {
    ref.current?.scrollTo({ y: i * ITEM_H, animated });
  }, []);

  // Initial scroll on mount
  const mounted = useRef(false);
  const onLayout = useCallback(() => {
    if (!mounted.current) {
      mounted.current = true;
      scrollTo(selectedIndex, false);
    }
  }, [selectedIndex, scrollTo]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y   = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    onChange(clamped);
    scrollTo(clamped);
    Haptics.selectionAsync();
  }, [items.length, onChange, scrollTo]);

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isDragging.current) return;
    onMomentumEnd(e);
  }, [onMomentumEnd]);

  // Padding items at top/bottom so first/last items can centre
  const padding = Math.floor(VISIBLE / 2);
  const padItems = Array(padding).fill("");

  return (
    <View style={[drum.wrap, { width }]}>
      {/* Centre highlight band */}
      <View style={drum.highlight} pointerEvents="none" />

      <ScrollView
        ref={ref}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={onLayout}
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onMomentumScrollEnd={(e) => { isDragging.current = false; onMomentumEnd(e); }}
        onScrollEndDrag={onScrollEnd}
        scrollEventThrottle={16}
      >
        {[...padItems, ...items, ...padItems].map((item, i) => {
          const realIdx = i - padding;
          const isSel   = realIdx === selectedIndex && item !== "";
          return (
            <Pressable
              key={i}
              style={drum.item}
              onPress={() => {
                if (item === "") return;
                onChange(realIdx);
                scrollTo(realIdx);
                Haptics.selectionAsync();
              }}
            >
              <Text style={[drum.itemText, isSel && drum.itemTextSel, item === "" && { opacity: 0 }]}>
                {item || "·"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Gradient fades top */}
      <View style={drum.fadeTop} pointerEvents="none" />
      <View style={drum.fadeBot} pointerEvents="none" />
    </View>
  );
}

const drum = StyleSheet.create({
  wrap: {
    height: DRUM_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  highlight: {
    position: "absolute",
    top: ITEM_H * 2, left: 0, right: 0,
    height: ITEM_H,
    backgroundColor: `${Colors.primary}18`,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: `${Colors.primary}44`,
    zIndex: 1,
  },
  item: {
    height: ITEM_H,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  itemTextSel: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  fadeTop: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: ITEM_H * 2,
    backgroundColor: `${Colors.cardBgElevated}`,
    opacity: 0.75,
    zIndex: 2,
    pointerEvents: "none",
  },
  fadeBot: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: ITEM_H * 2,
    backgroundColor: `${Colors.cardBgElevated}`,
    opacity: 0.75,
    zIndex: 2,
    pointerEvents: "none",
  },
});

// ── Date picker card ──────────────────────────────────────────────────────────
function DatePickerCard() {
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [dayIdx,   setDayIdx]   = useState(new Date().getDate() - 1);
  const [yearIdx,  setYearIdx]  = useState(0);

  const display = `${MONTHS[monthIdx]} ${DAYS[dayIdx]}, ${YEARS[yearIdx]}`;

  return (
    <View style={s.card}>
      <View style={s.drumRow}>
        <DrumPicker items={MONTHS}  selectedIndex={monthIdx} onChange={setMonthIdx} width={130} />
        <DrumPicker items={DAYS}    selectedIndex={dayIdx}   onChange={setDayIdx}   width={66} />
        <DrumPicker items={YEARS}   selectedIndex={yearIdx}  onChange={setYearIdx}  width={82} />
      </View>
      <View style={s.displayRow}>
        <Feather name="calendar" size={14} color={Colors.primary} />
        <Text style={s.displayText}>{display}</Text>
      </View>
    </View>
  );
}

// ── Time picker card ──────────────────────────────────────────────────────────
function TimePickerCard() {
  const now    = new Date();
  const h12    = now.getHours() % 12 || 12;
  const [hrIdx,  setHrIdx]  = useState(h12 - 1);
  const [minIdx, setMinIdx] = useState(now.getMinutes());
  const [apIdx,  setApIdx]  = useState(now.getHours() >= 12 ? 1 : 0);

  const display = `${HOURS[hrIdx]}:${MINUTES[minIdx]} ${AMPM[apIdx]}`;

  return (
    <View style={s.card}>
      <View style={s.drumRow}>
        <DrumPicker items={HOURS}   selectedIndex={hrIdx}  onChange={setHrIdx}  width={72} />
        <Text style={s.colon}>:</Text>
        <DrumPicker items={MINUTES} selectedIndex={minIdx} onChange={setMinIdx} width={72} />
        <DrumPicker items={AMPM}    selectedIndex={apIdx}  onChange={setApIdx}  width={66} />
      </View>
      <View style={s.displayRow}>
        <Feather name="clock" size={14} color={Colors.primary} />
        <Text style={s.displayText}>{display}</Text>
      </View>
    </View>
  );
}

// ── Calendar grid picker ──────────────────────────────────────────────────────
function CalendarCard() {
  const today  = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [day,   setDay]   = useState(today.getDate());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setDay(0);
  };
  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setDay(0);
  };

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const display = day > 0
    ? `${MONTHS[month]} ${day}, ${year}`
    : `${MONTHS[month]} ${year}`;

  return (
    <View style={s.card}>
      {/* Month nav */}
      <View style={cal.header}>
        <Pressable onPress={prev} style={cal.navBtn}>
          <Feather name="chevron-left" size={18} color={Colors.textSecondary} />
        </Pressable>
        <Text style={cal.monthLabel}>{MONTHS[month]} {year}</Text>
        <Pressable onPress={next} style={cal.navBtn}>
          <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={cal.dow}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <Text key={d} style={cal.dowText}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={cal.grid}>
        {cells.map((d, i) => {
          const sel    = d === day;
          const tod    = d !== null && isToday(d);
          return (
            <Pressable
              key={i}
              style={[cal.cell, sel && cal.cellSel, !d && { opacity: 0 }]}
              onPress={() => {
                if (!d) return;
                setDay(d);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              disabled={!d}
            >
              <Text style={[cal.cellText, sel && cal.cellTextSel, tod && !sel && cal.cellTextToday]}>
                {d ?? ""}
              </Text>
              {tod && !sel && <View style={cal.todayDot} />}
            </Pressable>
          );
        })}
      </View>

      <View style={s.displayRow}>
        <Feather name="calendar" size={14} color={Colors.primary} />
        <Text style={s.displayText}>{display}</Text>
      </View>
    </View>
  );
}

const DAY_W = 40;
const cal = StyleSheet.create({
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn:     { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.cardBgElevated, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  monthLabel: { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dow:        { flexDirection: "row", marginBottom: 4 },
  dowText:    { width: DAY_W, textAlign: "center", color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  grid:       { flexDirection: "row", flexWrap: "wrap" },
  cell:       { width: DAY_W, height: DAY_W, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cellSel:    { backgroundColor: Colors.primary },
  cellText:   { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" },
  cellTextSel:{ color: "#fff", fontFamily: "Inter_700Bold" },
  cellTextToday: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },
  todayDot:   { position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary },
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

type NotiVariant = "success" | "error" | "warning" | "info";

const NOTI_COLORS: Record<NotiVariant, { bg: string; border: string; icon: string; iconName: any }> = {
  success: { bg: "#0d2e1a", border: "#1e5c34", icon: "#40C057", iconName: "check-circle" },
  error:   { bg: "#2e0d0d", border: "#5c1e1e", icon: Colors.primary, iconName: "x-circle"  },
  warning: { bg: "#2e220d", border: "#5c4a1e", icon: "#FCC419", iconName: "alert-triangle" },
  info:    { bg: "#0d1a2e", border: "#1e3a5c", icon: "#4DABF7", iconName: "info"           },
};

// ── Toast (slides up from bottom) ────────────────────────────────────────────
function ToastDemo() {
  const [variant, setVariant] = useState<NotiVariant>("success");
  const slideY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (v: NotiVariant) => {
    setVariant(v);
    if (timer.current) clearTimeout(timer.current);
    // reset
    slideY.setValue(120); opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0,   useNativeDriver: false, tension: 160, friction: 14 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: false }),
    ]).start();
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideY,  { toValue: 120, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0,   duration: 220, useNativeDriver: false }),
      ]).start();
    }, 3000);
    Haptics.notificationAsync(
      v === "success" ? Haptics.NotificationFeedbackType.Success
        : v === "error" ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning
    );
  };

  const c = NOTI_COLORS[variant];

  return (
    <View>
      <View style={s.btnRow}>
        {(["success","error","warning","info"] as NotiVariant[]).map(v => (
          <Pressable key={v} style={[s.variantBtn, { borderColor: NOTI_COLORS[v].icon + "66" }]} onPress={() => show(v)}>
            <Feather name={NOTI_COLORS[v].iconName} size={14} color={NOTI_COLORS[v].icon} />
          </Pressable>
        ))}
      </View>
      {/* Preview area */}
      <View style={[s.card, { minHeight: 80, justifyContent: "flex-end", overflow: "hidden", padding: 0 }]}>
        <View style={[s.card, { margin: 0, borderRadius: 0, borderWidth: 0, flex: 1, alignItems: "center", justifyContent: "center" }]}>
          <Text style={s.previewHint}>Tap a type above to fire the toast</Text>
        </View>
        <Animated.View style={[noti.toast, { backgroundColor: c.bg, borderColor: c.border, opacity, transform: [{ translateY: slideY }] }]}>
          <Feather name={c.iconName} size={18} color={c.icon} />
          <View style={{ flex: 1 }}>
            <Text style={[noti.toastTitle, { color: c.icon }]}>{variant.charAt(0).toUpperCase() + variant.slice(1)}</Text>
            <Text style={noti.toastSub}>This is a {variant} notification toast</Text>
          </View>
          <Feather name="x" size={14} color={Colors.textMuted} />
        </Animated.View>
      </View>
    </View>
  );
}

// ── Banner (drops from top) ───────────────────────────────────────────────────
function BannerDemo() {
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<NotiVariant>("info");
  const slideY = useRef(new Animated.Value(-90)).current;
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (v: NotiVariant) => {
    if (timer.current) clearTimeout(timer.current);
    setVariant(v);
    setVisible(true);
    slideY.setValue(-90);
    Animated.spring(slideY, { toValue: 0, useNativeDriver: false, tension: 140, friction: 12 }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    timer.current = setTimeout(() => dismiss(), 3500);
  };

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(slideY, { toValue: -90, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => setVisible(false));
  };

  const c = NOTI_COLORS[variant];

  return (
    <View>
      <View style={s.btnRow}>
        {(["success","error","warning","info"] as NotiVariant[]).map(v => (
          <Pressable key={v} style={[s.variantBtn, { borderColor: NOTI_COLORS[v].icon + "66" }]} onPress={() => show(v)}>
            <Feather name={NOTI_COLORS[v].iconName} size={14} color={NOTI_COLORS[v].icon} />
          </Pressable>
        ))}
      </View>
      <View style={[s.card, { minHeight: 80, overflow: "hidden", padding: 0 }]}>
        <View style={[s.card, { margin: 0, borderRadius: 0, borderWidth: 0, flex: 1, alignItems: "center", justifyContent: "center" }]}>
          <Text style={s.previewHint}>Tap a type — banner drops from top</Text>
        </View>
        {visible && (
          <Animated.View style={[noti.banner, { backgroundColor: c.bg, borderColor: c.border, transform: [{ translateY: slideY }] }]}>
            <Feather name={c.iconName} size={16} color={c.icon} />
            <View style={{ flex: 1 }}>
              <Text style={[noti.toastTitle, { color: c.icon }]}>{variant.charAt(0).toUpperCase() + variant.slice(1)}</Text>
              <Text style={noti.toastSub}>Tap to dismiss</Text>
            </View>
            <Pressable onPress={dismiss}>
              <Feather name="x" size={14} color={Colors.textMuted} />
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ── Inline alert cards ────────────────────────────────────────────────────────
function InlineAlerts() {
  const [dismissed, setDismissed] = useState<Set<NotiVariant>>(new Set());

  const dismiss = (v: NotiVariant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissed(prev => new Set([...prev, v]));
  };

  const all: { v: NotiVariant; title: string; msg: string }[] = [
    { v: "success", title: "Changes saved",        msg: "Your task list has been updated successfully."      },
    { v: "info",    title: "Sync in progress",      msg: "Pulling latest data from Notion — hang tight."      },
    { v: "warning", title: "Offline mode",          msg: "Changes will sync when you're back online."         },
    { v: "error",   title: "Sync failed",           msg: "Couldn't reach the server. Check your connection."  },
  ];

  const visible = all.filter(a => !dismissed.has(a.v));

  return (
    <View style={{ gap: 8 }}>
      {visible.length === 0 ? (
        <Pressable style={[s.card, { alignItems: "center", gap: 8 }]} onPress={() => setDismissed(new Set())}>
          <Feather name="refresh-cw" size={16} color={Colors.textMuted} />
          <Text style={s.previewHint}>Tap to reset</Text>
        </Pressable>
      ) : visible.map(({ v, title, msg }) => {
        const c = NOTI_COLORS[v];
        return (
          <View key={v} style={[noti.alertCard, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Feather name={c.iconName} size={16} color={c.icon} />
            <View style={{ flex: 1 }}>
              <Text style={[noti.alertTitle, { color: c.icon }]}>{title}</Text>
              <Text style={noti.alertMsg}>{msg}</Text>
            </View>
            <Pressable onPress={() => dismiss(v)} hitSlop={8}>
              <Feather name="x" size={13} color={Colors.textMuted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ── Badge / counter notification ──────────────────────────────────────────────
function BadgeDemo() {
  const [count, setCount] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const bump = () => {
    setCount(c => c + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.5, duration: 80, useNativeDriver: false }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: false, tension: 200, friction: 10 }),
    ]).start();
  };

  const clear = () => {
    setCount(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(scaleAnim, { toValue: 0.1, useNativeDriver: false, tension: 200, friction: 12 }).start(() => scaleAnim.setValue(1));
  };

  return (
    <View style={[s.card, { flexDirection: "row", alignItems: "center", gap: 16, justifyContent: "space-between" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={noti.iconWrap}>
          <Feather name="bell" size={22} color={Colors.textSecondary} />
          {count > 0 && (
            <Animated.View style={[noti.badge, { transform: [{ scale: scaleAnim }] }]}>
              <Text style={noti.badgeText}>{count > 99 ? "99+" : count}</Text>
            </Animated.View>
          )}
        </View>
        <View>
          <Text style={s.sectionTitle}>Notifications</Text>
          <Text style={s.sectionSub}>{count === 0 ? "None" : `${count} unread`}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable style={s.ghostBtn} onPress={bump}>
          <Text style={s.ghostBtnTx}>+1</Text>
        </Pressable>
        {count > 0 && (
          <Pressable style={[s.ghostBtn, { borderColor: Colors.primary + "55" }]} onPress={clear}>
            <Text style={[s.ghostBtnTx, { color: Colors.primary }]}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const noti = StyleSheet.create({
  toast: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderTopWidth: 1,
  },
  toastTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 1 },
  toastSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  banner: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderBottomWidth: 1,
  },
  alertCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  alertTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  alertMsg:   { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 17 },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute", top: -6, right: -6,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: Colors.darkBg,
  },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PickersScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Pickers & Notifications" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── DATE & TIME ── */}
        <SectionLabel n="1" title="Scroll-wheel Date Picker" sub="Drum roll — scroll each column to pick" />
        <DatePickerCard />

        <SectionLabel n="2" title="Scroll-wheel Time Picker" sub="12-hour with AM / PM drum" />
        <TimePickerCard />

        <SectionLabel n="3" title="Calendar Grid Picker" sub="Tap a day — today is dotted" />
        <CalendarCard />

        {/* ── NOTIFICATIONS ── */}
        <SectionLabel n="4" title="Toast Notification" sub="Slides up from the bottom, auto-dismisses after 3s" />
        <ToastDemo />

        <SectionLabel n="5" title="Banner Notification" sub="Drops from the top of the card" />
        <BannerDemo />

        <SectionLabel n="6" title="Inline Alert Cards" sub="Persistent — dismiss individually with ×" />
        <InlineAlerts />

        <SectionLabel n="7" title="Badge Counter" sub="Tap +1 to stack, pop animation on each bump" />
        <BadgeDemo />

      </ScrollView>
    </View>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },

  sectionHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 28, marginBottom: 10 },
  badge:       { width: 26, height: 26, borderRadius: 8, backgroundColor: `${Colors.primary}22`, borderWidth: 1, borderColor: `${Colors.primary}55`, alignItems: "center", justifyContent: "center" },
  badgeText:   { color: Colors.primary, fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionTitle:{ color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionSub:  { color: Colors.textMuted,   fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  card: {
    backgroundColor: Colors.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 12,
  },
  drumRow: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  colon:   { color: Colors.textSecondary, fontSize: 24, fontFamily: "Inter_700Bold", marginHorizontal: -2 },
  displayRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  displayText: { color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_500Medium" },

  btnRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  variantBtn: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.cardBgElevated,
  },
  previewHint: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },

  ghostBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  ghostBtnTx: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },
});
