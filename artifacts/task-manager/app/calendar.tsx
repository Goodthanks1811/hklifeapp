import { Feather } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";
import React, {
  useCallback, useEffect, useRef, useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/context/DrawerContext";
import { Colors } from "@/constants/colors";

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG   = "#0b0b0c";
const RED  = Colors.primary;       // #E03131
const TEXT = Colors.textPrimary;   // #fff
const SUB  = Colors.textSecondary; // #A0A0A0
const MUT  = Colors.textMuted;     // #666
const CARD = Colors.cardBg;        // #1A1A1A
const CARD2 = Colors.cardBgElevated; // #222
const BORD = Colors.border;        // #2A2A2A

const HK_BG  = "rgba(30,120,255,0.18)"; const HK_BR = "rgba(30,120,255,0.65)"; const HK_TX = "#5aa5ff";
const ST_BG  = "rgba(255,30,30,0.18)";  const ST_BR = "rgba(255,30,30,0.65)";  const ST_TX = "#ff5555";

// ── Calendar data ─────────────────────────────────────────────────────────────
const DAYS_AHEAD = 60;
const ALLOWED    = ["hk", "birthday", "sticky", "ele"];
const DAYS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS_S   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_L   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_U   = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DOW_HEADS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ── Drum data ─────────────────────────────────────────────────────────────────
const HOURS_W   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES_W = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const AMPM_W    = ["AM", "PM"];

const DURATIONS = [
  { label: "30m", mins: 30  },
  { label: "1hr", mins: 60  },
  { label: "2hr", mins: 120 },
  { label: "3hr", mins: 180 },
  { label: "4hr", mins: 240 },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalEvent   { id: string; title: string; timeStr: string; dotColor: string; }
interface DaySection { dateKey: string; dayLabel: string; ordStr: string; isToday: boolean; weekStart: boolean; data: CalEvent[]; }
type EventType = "appointment" | "allday" | "birthday";
type CalKey    = "HK" | "Sticky";
type Step      = "idle" | "title" | "detail";

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function ordinal(n: number) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmt12(d: Date) {
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}${m > 0 ? ":" + pad(m) : ""}${h >= 12 ? "pm" : "am"}`;
}
function isoDay(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function normalDay(d: Date): Date { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; }
function keepCal(t: string) { const l = t.trim().toLowerCase(); return ALLOWED.some(a => l === a); }
function fmtTimeLbl(hIdx: number, mIdx: number, apIdx: number) {
  return `${HOURS_W[hIdx]}:${MINUTES_W[mIdx]} ${AMPM_W[apIdx]}`;
}

// ── DrumPicker — exact match to ui-kit ────────────────────────────────────────
const ITEM_H  = 30;
const VISIBLE = 5;
const DRUM_H  = ITEM_H * VISIBLE;
const PADDING = Math.floor(VISIBLE / 2); // 2

function DrumPicker({
  items, selectedIndex, onChange, width = 90,
  looping = false, onWrapForward, onWrapBack, onDragStart, onDragEnd,
}: {
  items: string[]; selectedIndex: number; onChange: (i: number) => void; width?: number;
  looping?: boolean; onWrapForward?: () => void; onWrapBack?: () => void;
  onDragStart?: () => void; onDragEnd?: () => void;
}) {
  const n        = items.length;
  const ref      = useRef<ScrollView>(null);
  const dragging = useRef(false);
  const mounted  = useRef(false);
  const prevSel  = useRef(selectedIndex);

  // Looping: triple the array so user can scroll through seam; non-looping: blank padding
  const rows = looping
    ? [...items, ...items, ...items]
    : [...Array(PADDING).fill(""), ...items, ...Array(PADDING).fill("")];

  const scrollTo = useCallback((pos: number, animated = true) => {
    ref.current?.scrollTo({ y: pos * ITEM_H, animated });
  }, []);

  const onLayout = useCallback(() => {
    if (!mounted.current) {
      mounted.current = true;
      scrollTo(looping ? n + selectedIndex : selectedIndex, false);
    }
  }, [selectedIndex, scrollTo, looping, n]);

  // Sync AMPM drum when selectedIndex flips due to hour wrap
  useEffect(() => {
    if (!mounted.current || dragging.current) return;
    if (selectedIndex !== prevSel.current) {
      prevSel.current = selectedIndex;
      scrollTo(looping ? n + selectedIndex : selectedIndex, true);
    }
  }, [selectedIndex, scrollTo, looping, n]);

  const snap = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y      = e.nativeEvent.contentOffset.y;
    const maxIdx = looping ? n * 3 - 1 : n + PADDING * 2 - 1;
    const rawIdx = Math.max(0, Math.min(maxIdx, Math.round(y / ITEM_H)));

    if (looping) {
      const actual = rawIdx % n;
      if (rawIdx < n) {
        onWrapBack?.();
        requestAnimationFrame(() => scrollTo(n + actual, false));
      } else if (rawIdx >= 2 * n) {
        onWrapForward?.();
        requestAnimationFrame(() => scrollTo(n + actual, false));
      }
      prevSel.current = actual;
      onChange(actual);
    } else {
      const idx = Math.max(0, Math.min(n - 1, rawIdx - PADDING));
      prevSel.current = idx;
      onChange(idx);
      scrollTo(idx, true);
    }
    Haptics.selectionAsync();
  }, [looping, n, onChange, onWrapForward, onWrapBack, scrollTo]);

  return (
    <View style={[dp.wrap, { width }]}>
      <View style={dp.highlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onLayout={onLayout}
        onScrollBeginDrag={() => { dragging.current = true; onDragStart?.(); }}
        onMomentumScrollEnd={e => { dragging.current = false; snap(e); onDragEnd?.(); }}
        onScrollEndDrag={e => { if (!dragging.current) { snap(e); onDragEnd?.(); } }}
        scrollEventThrottle={16}
      >
        {rows.map((item, i) => {
          const actual = looping ? i % n : i - PADDING;
          const sel    = actual === selectedIndex && (looping || item !== "");
          const blank  = !looping && item === "";
          return (
            <Pressable key={i} style={dp.item}
              onPress={() => {
                if (blank) return;
                onChange(actual);
                scrollTo(looping ? n + actual : actual);
                Haptics.selectionAsync();
              }}
            >
              <Text style={[dp.itemTxt, sel && dp.itemTxtSel, blank && { opacity: 0 }]}>
                {item || (blank ? "·" : "")}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={dp.fadeT} pointerEvents="none" />
      <View style={dp.fadeB} pointerEvents="none" />
    </View>
  );
}

const dp = StyleSheet.create({
  wrap: {
    height: DRUM_H, borderRadius: 14, overflow: "hidden",
    backgroundColor: CARD2, borderWidth: 1, borderColor: BORD,
  },
  highlight: {
    position: "absolute", top: ITEM_H * PADDING, left: 0, right: 0, height: ITEM_H,
    backgroundColor: `${RED}18`,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: `${RED}44`, zIndex: 1,
  },
  item:       { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemTxt:    { color: MUT,  fontSize: 16, fontFamily: "Inter_400Regular" },
  itemTxtSel: { color: TEXT, fontSize: 17, fontFamily: "Inter_700Bold" },
  fadeT: {
    position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * PADDING,
    backgroundColor: CARD2, opacity: 0.75, zIndex: 2, pointerEvents: "none",
  },
  fadeB: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: ITEM_H * PADDING,
    backgroundColor: CARD2, opacity: 0.75, zIndex: 2, pointerEvents: "none",
  },
});

// ── MonthCalendarGrid ─────────────────────────────────────────────────────────
const SW    = Dimensions.get("window").width;
const HPAD  = 24;
const DAY_W = Math.floor((SW - HPAD * 2) / 7);

function MonthCalendarGrid({
  selected, onChange,
}: {
  selected: Date; onChange: (d: Date) => void;
}) {
  const today = normalDay(new Date());
  const [vy, setVy] = useState(selected.getFullYear());
  const [vm, setVm] = useState(selected.getMonth());

  const prevM = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (vm === 0) { setVy(y => y - 1); setVm(11); } else setVm(m => m - 1);
  };
  const nextM = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (vm === 11) { setVy(y => y + 1); setVm(0); } else setVm(m => m + 1);
  };

  const firstDow  = new Date(vy, vm, 1).getDay();
  const daysInMon = new Date(vy, vm + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null).concat(
    Array.from({ length: daysInMon }, (_, i) => i + 1)
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const isSel   = (d: number) => selected.getFullYear() === vy && selected.getMonth() === vm && selected.getDate() === d;
  const isToday = (d: number) => today.getFullYear() === vy && today.getMonth() === vm && today.getDate() === d;

  const pick = (d: number) => {
    const n = new Date(vy, vm, d); n.setHours(0, 0, 0, 0);
    onChange(n);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View>
      {/* Month nav */}
      <View style={cg.nav}>
        <Pressable onPress={prevM} hitSlop={14} style={cg.navBtn}>
          <Feather name="chevron-left" size={18} color={SUB} />
        </Pressable>
        <Text style={cg.navLabel}>{MONTHS_L[vm]} {vy}</Text>
        <Pressable onPress={nextM} hitSlop={14} style={cg.navBtn}>
          <Feather name="chevron-right" size={18} color={SUB} />
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={cg.dowRow}>
        {DOW_HEADS.map((d, i) => <Text key={i} style={cg.dow}>{d}</Text>)}
      </View>

      {/* Grid */}
      <View style={cg.grid}>
        {cells.map((day, i) => {
          const sel = day !== null && isSel(day);
          const tod = day !== null && isToday(day);
          return (
            <Pressable key={i}
              style={[cg.cell, sel && cg.cellSel, !day && { opacity: 0 }]}
              onPress={() => { if (day) pick(day); }}
              disabled={!day}
            >
              <Text style={[cg.cellTxt, sel && cg.cellTxtSel, tod && !sel && cg.cellTxtToday]}>
                {day ?? ""}
              </Text>
              {tod && !sel && <View style={cg.todayDot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const cg = StyleSheet.create({
  nav:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  navBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: CARD2, borderWidth: 1, borderColor: BORD, alignItems: "center", justifyContent: "center" },
  navLabel: { color: TEXT, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dowRow:   { flexDirection: "row", marginBottom: 4 },
  dow:      { width: DAY_W, textAlign: "center", color: MUT, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  grid:     { flexDirection: "row", flexWrap: "wrap" },
  cell:     { width: DAY_W, height: Math.round(DAY_W * 0.78), borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cellSel:  { backgroundColor: RED },
  cellTxt:      { color: SUB, fontSize: 15, fontFamily: "Inter_400Regular" },
  cellTxtSel:   { color: "#fff", fontFamily: "Inter_700Bold" },
  cellTxtToday: { color: RED, fontFamily: "Inter_600SemiBold" },
  todayDot: { position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: RED },
});

// ── TitleModal (Step 1) ────────────────────────────────────────────────────────
function TitleModal({
  visible, initialValue, onCancel, onNext,
}: {
  visible: boolean; initialValue: string;
  onCancel: () => void; onNext: (title: string) => void;
}) {
  const [val, setVal] = useState(initialValue);
  useEffect(() => { if (visible) setVal(initialValue); }, [visible, initialValue]);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    shakeAnim.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 45, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const shakeX = shakeAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-10, 0, 10] });

  const handleNext = useCallback(() => {
    if (val.trim().length > 0) onNext(val.trim());
    else shake();
  }, [val, onNext, shake]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={tm.overlay}>
        <Animated.View style={[tm.card, { transform: [{ translateX: shakeX }] }]}>
          <Text style={tm.cardTitle}>New Event</Text>
          <TextInput
            style={tm.input}
            placeholder="Event name…"
            placeholderTextColor={MUT}
            value={val}
            onChangeText={setVal}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={handleNext}
            selectionColor={RED}
          />
          <View style={tm.btnRow}>
            <Pressable onPress={onCancel} style={tm.btnCancel} hitSlop={8}>
              <Text style={tm.btnCancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleNext} style={tm.btnNext} hitSlop={8}>
              <Text style={tm.btnNextTxt}>Next</Text>
              <Feather name="arrow-right" size={15} color="#fff" />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const tm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 28,
  },
  card: {
    width: "100%", backgroundColor: CARD,
    borderRadius: 18, borderWidth: 1, borderColor: BORD,
    padding: 22, gap: 16,
  },
  cardTitle: { color: TEXT, fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  input: {
    backgroundColor: CARD2, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 12, color: TEXT, fontSize: 17, fontFamily: "Inter_400Regular",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
  btnCancel: { paddingVertical: 10, paddingRight: 8 },
  btnCancelTxt: { color: MUT, fontSize: 15, fontFamily: "Inter_500Medium" },
  btnNext: { flex: 1, backgroundColor: RED, borderRadius: 12, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginLeft: 12 },
  btnNextTxt: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ── EventDetailScreen (Step 2) ────────────────────────────────────────────────
function EventDetailScreen({
  eventTitle, onBack, onSaved,
}: {
  eventTitle: string; onBack: () => void; onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();

  const [date,    setDate]    = useState(() => normalDay(new Date()));
  const [evType,  setEvType]  = useState<EventType | null>(null);
  const [hourIdx, setHourIdx]           = useState(8);  // "09"
  const [minIdx,  setMinIdx]            = useState(0);
  const [ampmIdx, setAmpmIdx]           = useState(0);  // AM
  const [pageScrollEnabled, setPageScroll] = useState(true);
  const flipAmpm = useCallback(() => setAmpmIdx(p => (p + 1) % 2), []);
  const [durMins, setDurMins] = useState(-1);
  const [calKey,  setCalKey]  = useState<CalKey>("HK");
  const [saving,  setSaving]  = useState(false);
  const [errMsg,  setErrMsg]  = useState("");

  const slideY = useRef(new Animated.Value(Dimensions.get("window").height)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: 0, useNativeDriver: true, damping: 32, stiffness: 300, overshootClamping: true,
    }).start();
  }, [slideY]);

  const back = useCallback(() => {
    Animated.timing(slideY, {
      toValue: Dimensions.get("window").height, duration: 280,
      easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => onBack());
  }, [slideY, onBack]);

  const canSave = evType !== null && (evType !== "appointment" || durMins >= 0);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true); setErrMsg("");
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") throw new Error("Calendar access required — enable in Settings.");

      const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      let targetId: string | null = null;
      if (evType === "birthday") {
        targetId = allCals.find(c => c.title.toLowerCase() === "birthday")?.id
                ?? allCals.find(c => c.title.toLowerCase() === "hk")?.id ?? null;
      } else {
        targetId = allCals.find(c => c.title.toLowerCase() === calKey.toLowerCase())?.id ?? null;
      }
      if (!targetId) throw new Error(`Couldn't find "${calKey}" calendar on this device.`);

      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 0);

      if (evType === "allday") {
        await Calendar.createEventAsync(targetId, { title: eventTitle, startDate: dayStart, endDate: dayEnd, allDay: true });
      } else if (evType === "birthday") {
        await Calendar.createEventAsync(targetId, {
          title: eventTitle, startDate: dayStart, endDate: dayEnd, allDay: true,
          recurrenceRule: { frequency: Calendar.Frequency.YEARLY, interval: 1 },
          alarms: [{ relativeOffset: 330 }],
        });
      } else {
        const h    = parseInt(HOURS_W[hourIdx], 10);
        const h24  = ampmIdx === 1 ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
        const startDate = new Date(date); startDate.setHours(h24, parseInt(MINUTES_W[minIdx], 10), 0, 0);
        const endDate   = new Date(startDate.getTime() + durMins * 60000);
        await Calendar.createEventAsync(targetId, { title: eventTitle, startDate, endDate, allDay: false });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch (e: any) {
      setErrMsg(e?.message ?? "Failed to save event.");
    } finally {
      setSaving(false);
    }
  };

  const TYPE_PILLS: { key: EventType; icon: string; label: string }[] = [
    { key: "appointment", icon: "🕒", label: "Appointment" },
    { key: "allday",      icon: "📆", label: "All Day"     },
    { key: "birthday",    icon: "🎂", label: "Birthday"    },
  ];

  return (
    <Animated.View style={[ed.root, { paddingTop: insets.top, paddingBottom: insets.bottom, transform: [{ translateY: slideY }] }]}>
      {/* ── Nav bar ── */}
      <View style={ed.nav}>
        <Pressable onPress={back} hitSlop={14} style={ed.navBack}>
          <Feather name="arrow-left" size={20} color={SUB} />
        </Pressable>
        <Text style={ed.navTitle} numberOfLines={1}>{eventTitle}</Text>
        <View style={ed.navSpacer} />
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={ed.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={pageScrollEnabled}
      >
        {/* Calendar grid */}
        <View style={ed.section}>
          <MonthCalendarGrid selected={date} onChange={setDate} />
        </View>

        {/* Type pills */}
        <View style={ed.pillRow}>
          {TYPE_PILLS.map(tp => {
            const active = evType === tp.key;
            return (
              <Pressable key={tp.key}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEvType(tp.key); }}
                style={[ed.typePill, active && ed.typePillActive]}
              >
                <Text style={ed.typePillIcon}>{tp.icon}</Text>
                <Text style={[ed.typePillTxt, active && ed.typePillTxtActive]}>{tp.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Appointment: time card + duration */}
        {evType === "appointment" && (
          <>
            {/* Time — ui-kit card style */}
            <View style={ed.card}>
              <View style={ed.drumRow}>
                <DrumPicker items={HOURS_W}   selectedIndex={hourIdx}  onChange={setHourIdx}  width={72}
                  looping onWrapForward={flipAmpm} onWrapBack={flipAmpm}
                  onDragStart={() => setPageScroll(false)} onDragEnd={() => setPageScroll(true)} />
                <Text style={ed.colon}>:</Text>
                <DrumPicker items={MINUTES_W} selectedIndex={minIdx}   onChange={setMinIdx}   width={72}
                  onDragStart={() => setPageScroll(false)} onDragEnd={() => setPageScroll(true)} />
                <DrumPicker items={AMPM_W}    selectedIndex={ampmIdx}  onChange={setAmpmIdx}  width={66}
                  onDragStart={() => setPageScroll(false)} onDragEnd={() => setPageScroll(true)} />
              </View>
              <View style={ed.displayRow}>
                <Feather name="clock" size={14} color={RED} />
                <Text style={ed.displayTxt}>{fmtTimeLbl(hourIdx, minIdx, ampmIdx)}</Text>
              </View>
            </View>

            {/* Duration */}
            <View style={ed.durRow}>
              {DURATIONS.map(d => {
                const active = durMins === d.mins;
                return (
                  <Pressable key={d.label}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDurMins(d.mins); }}
                    style={[ed.durPill, active && ed.durPillActive]}
                  >
                    <Text style={[ed.durPillTxt, active && ed.durPillTxtActive]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Calendar: HK / Sticky (not birthday) */}
        {evType !== null && evType !== "birthday" && (
          <View style={ed.pillRow}>
            {(["HK", "Sticky"] as CalKey[]).map(k => {
              const active = calKey === k;
              const isHK   = k === "HK";
              return (
                <Pressable key={k}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCalKey(k); }}
                  style={[ed.calPill, {
                    backgroundColor: active ? (isHK ? HK_BG : ST_BG) : CARD,
                    borderColor:      active ? (isHK ? HK_BR : ST_BR) : BORD,
                  }]}
                >
                  <View style={[ed.calDot, { backgroundColor: isHK ? HK_TX : ST_TX }]} />
                  <Text style={[ed.calPillTxt, { color: active ? (isHK ? HK_TX : ST_TX) : MUT }]}>{k}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Error */}
        {errMsg !== "" && (
          <View style={ed.errRow}>
            <Feather name="alert-circle" size={13} color={RED} />
            <Text style={ed.errTxt}>{errMsg}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom Save button ── */}
      <View style={ed.saveWrap}>
        <Pressable
          onPress={save}
          disabled={!canSave || saving}
          style={[ed.saveBtn, (!canSave || saving) && { opacity: 0.4 }]}
        >
          <Text style={ed.saveBtnTxt}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const ed = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG, zIndex: 100,
  },
  nav: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  navBack:    { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navTitle:   { flex: 1, textAlign: "center", color: TEXT, fontSize: 16, fontFamily: "Inter_700Bold", paddingHorizontal: 8 },
  navSpacer:  { width: 36 },

  scroll:  { padding: HPAD, paddingBottom: 16, gap: 18 },

  saveWrap: { paddingHorizontal: HPAD, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  saveBtn:  { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnTxt: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  section: {},

  // Type pills — horizontal icon + label
  pillRow: { flexDirection: "row", gap: 9 },
  typePill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORD,
    borderRadius: 12, paddingVertical: 13,
  },
  typePillActive:     { backgroundColor: `${RED}18`, borderColor: `${RED}66` },
  typePillIcon:       { fontSize: 15 },
  typePillTxt:        { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT },
  typePillTxtActive:  { color: "#e07070" },

  // Time card — exact ui-kit card style
  card: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD,
    padding: 14, gap: 12,
  },
  drumRow:    { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  colon:      { color: TEXT, fontSize: 24, fontFamily: "Inter_700Bold", marginHorizontal: -2 },
  displayRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: BORD },
  displayTxt: { color: TEXT, fontSize: 13, fontFamily: "Inter_500Medium" },

  // Duration pills
  durRow: { flexDirection: "row", gap: 8 },
  durPill: {
    flex: 1, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORD,
    borderRadius: 10, paddingVertical: 11, alignItems: "center",
  },
  durPillActive:    { backgroundColor: `${RED}18`, borderColor: `${RED}66` },
  durPillTxt:       { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT },
  durPillTxtActive: { color: "#e07070" },

  // Calendar pills
  calPill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 15,
  },
  calDot:    { width: 9, height: 9, borderRadius: 5 },
  calPillTxt:{ fontSize: 15, fontFamily: "Inter_700Bold" },

  // Error
  errRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errTxt: { color: RED, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
});

// ── CalendarScreen ─────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [status,     setStatus]     = useState<"idle"|"loading"|"error"|"done">("idle");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [sections,   setSections]   = useState<DaySection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [monthLabel, setMonthLabel] = useState(() => MONTHS_U[new Date().getMonth()]);

  // Two-step create flow
  const [step,         setStep]         = useState<Step>("idle");
  const [pendingTitle, setPendingTitle] = useState("");
  const [eventTitle,   setEventTitle]   = useState("");

  const fetchEvents = useCallback(async () => {
    try {
      const { status: perm } = await Calendar.requestCalendarPermissionsAsync();
      if (perm !== "granted") { setErrorMsg("Calendar access required. Enable in Settings."); setStatus("error"); return; }

      const allCals  = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const hkCals   = allCals.filter(c => keepCal(c.title));
      if (!hkCals.length) { setSections([]); setStatus("done"); return; }

      const today    = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const endDate  = new Date(today); endDate.setDate(today.getDate() + DAYS_AHEAD);

      const raw = await Calendar.getEventsAsync(hkCals.map(c => c.id), today, endDate);
      raw.sort((a, b) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime());

      const dayMap = new Map<string, DaySection>();
      for (const ev of raw) {
        if (!ev.title) continue;
        const start      = new Date(ev.startDate as any);
        const key        = isoDay(start);
        const calName    = hkCals.find(c => c.id === ev.calendarId)?.title.toLowerCase() ?? "";
        const isBirthday = calName === "birthday";
        const isSticky   = calName === "sticky";
        const isTraining = ev.title.toLowerCase().includes("training");
        const title      = isBirthday ? `🎂 ${ev.title}` : ev.title;
        const dotColor   = isTraining ? "#2ecc71" : isSticky ? "#ff5555" : "#5aa5ff";

        if (!dayMap.has(key)) {
          const isToday    = start.toDateString() === today.toDateString();
          const isTomorrow = start.toDateString() === tomorrow.toDateString();
          dayMap.set(key, {
            dateKey:  key,
            dayLabel: isToday ? "Today" : isTomorrow ? "Tomorrow" : DAYS_FULL[start.getDay()],
            ordStr:   `${ordinal(start.getDate())} ${MONTHS_S[start.getMonth()]}`,
            isToday,
            weekStart: false,
            data:     [],
          });
        }
        dayMap.get(key)!.data.push({ id: ev.id, title, timeStr: ev.allDay ? "All Day" : fmt12(start), dotColor });
      }
      const sorted = Array.from(dayMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      sorted.forEach((sec, i) => {
        const dow = new Date(sec.dateKey + "T00:00:00").getDay();
        sec.weekStart = i > 0 && dow === 1; // Monday = 1
      });
      setSections(sorted);
      setStatus("done");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load events");
      setStatus("error");
    }
  }, []);

  useEffect(() => { setStatus("loading"); fetchEvents(); }, [fetchEvents]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true); await fetchEvents(); setRefreshing(false);
  }, [fetchEvents]);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 10 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems.find((v: any) => v.isViewable && v.section?.dateKey);
    if (first?.section?.dateKey) {
      const month = parseInt(first.section.dateKey.split("-")[1], 10) - 1;
      setMonthLabel(MONTHS_U[month]);
    }
  }).current;

  const renderSectionHeader = useCallback(({ section }: { section: DaySection }) => (
    <View style={{ backgroundColor: BG }}>
      {section.weekStart && <View style={s.weekDivider} />}
      <View style={[s.dayHdr, section.isToday && s.dayHdrToday]}>
        <Text style={s.dlDay}>{section.dayLabel}</Text>
        <Text style={s.dlSep}>·</Text>
        <Text style={s.dlDate}>{section.ordStr}</Text>
      </View>
    </View>
  ), []);

  const renderItem = useCallback(({ item, index }: { item: CalEvent; index: number }) => (
    <View style={[s.evRow, index > 0 && s.evRowBorder]}>
      <Text style={s.tStart}>{item.timeStr}</Text>
      <View style={s.evMain}>
        <View style={[s.evDot, { backgroundColor: item.dotColor }]} />
        <Text style={s.evTitle}>{item.title}</Text>
      </View>
    </View>
  ), []);

  const renderSectionFooter = useCallback(() => <View style={s.dayFooter} />, []);

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Pressable onPress={toggleDrawer} hitSlop={12} style={s.hamburger}>
          <View style={[s.hLine, { width: 22 }]} />
          <View style={[s.hLine, { width: 15 }]} />
          <View style={[s.hLine, { width: 22 }]} />
        </Pressable>
        <Text style={s.hdrMonth}>{monthLabel}</Text>
      </View>

      {status === "loading" && !refreshing && (
        <><View style={s.inlineTitle}><TitleTxt /></View><View style={s.center}><Spinner /></View></>
      )}

      {status === "error" && (
        <><View style={s.inlineTitle}><TitleTxt /></View>
          <View style={s.center}>
            <Feather name="alert-circle" size={28} color={RED} style={{ marginBottom: 8 }} />
            <Text style={s.errorTxt}>{errorMsg}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setStatus("loading"); fetchEvents(); }}>
              <Text style={s.retryTxt}>Try Again</Text>
            </Pressable>
          </View>
        </>
      )}

      {status === "done" && (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          renderItem={renderItem}
          stickySectionHeadersEnabled
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={RED} />}
          ListHeaderComponent={<View style={s.inlineTitle}><TitleTxt /></View>}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="calendar" size={32} color="rgba(255,255,255,0.22)" />
              <Text style={s.emptyTxt}>No upcoming events</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: botPad + 80 }}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}

      {/* FAB — hidden during create flow */}
      {step === "idle" && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep("title"); setPendingTitle(""); }}
          style={({ pressed }) => [s.fab, pressed && { opacity: 0.82 }]}
        >
          <Feather name="plus" size={22} color="#fff" />
        </Pressable>
      )}

      {/* Step 1: title modal */}
      <TitleModal
        visible={step === "title"}
        initialValue={pendingTitle}
        onCancel={() => { setStep("idle"); setPendingTitle(""); }}
        onNext={title => { setEventTitle(title); setStep("detail"); }}
      />

      {/* Step 2: full screen detail */}
      {step === "detail" && (
        <EventDetailScreen
          eventTitle={eventTitle}
          onBack={() => { setStep("title"); setPendingTitle(eventTitle); }}
          onSaved={() => { setStep("idle"); setStatus("loading"); fetchEvents(); }}
        />
      )}
    </View>
  );
}

function TitleTxt() {
  return (
    <Text style={s.hdrTitle}>
      <Text style={{ color: "#fff" }}>HK </Text>
      <Text style={{ color: RED }}>Calendar</Text>
    </Text>
  );
}

function Spinner() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(rot, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true })).start();
  }, [rot]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={[s.spinner, { transform: [{ rotate: spin }] }]} />;
}

const BORD_LINE = "rgba(255,255,255,0.07)";
const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG },
  topBar:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 14, paddingBottom: 13, backgroundColor: BG },
  hamburger:  { gap: 5 },
  hLine:      { height: 1.5, backgroundColor: TEXT, borderRadius: 2 },
  hdrTitle:   { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.8, lineHeight: 32 },
  hdrMonth:   { fontSize: 11, color: MUT, fontFamily: "Inter_400Regular", letterSpacing: 1.2 },
  inlineTitle:{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: BORD_LINE, backgroundColor: BG, alignItems: "center" },
  dayHdr:     { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6, paddingTop: 14, paddingBottom: 5, paddingHorizontal: 22, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORD_LINE },
  dayHdrToday:{ backgroundColor: "#0d0d0f" },
  dlDay:      { fontSize: 17, fontFamily: "Inter_700Bold", color: RED, letterSpacing: -0.3 },
  dlSep:      { fontSize: 14, color: `${RED}44` },
  dlDate:     { fontSize: 17, fontFamily: "Inter_700Bold", color: RED, letterSpacing: -0.3 },
  dayFooter:  { height: 10, backgroundColor: BG },
  weekDivider:{ height: 1, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 22, marginTop: 4, marginBottom: 2 },
  evRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 22, backgroundColor: BG, gap: 12 },
  evRowBorder:{ borderTopWidth: 1, borderTopColor: BORD_LINE },
  tStart:     { width: 58, flexShrink: 0, fontSize: 12, fontFamily: "Inter_500Medium", color: TEXT },
  evMain:     { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  evDot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  evTitle:    { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT, lineHeight: 20 },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 32 },
  errorTxt:   { color: SUB, fontSize: 14, textAlign: "center", fontFamily: "Inter_400Regular", lineHeight: 20 },
  retryBtn:   { backgroundColor: RED, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, marginTop: 4 },
  retryTxt:   { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  empty:      { alignItems: "center", marginTop: 64, gap: 12 },
  emptyTxt:   { color: MUT, fontSize: 14, fontFamily: "Inter_400Regular" },
  spinner:    { width: 48, height: 48, borderRadius: 24, borderWidth: 5, borderColor: `${RED}22`, borderTopColor: RED },
  fab:        { position: "absolute", bottom: 32, right: 20, width: 48, height: 48, borderRadius: 14, backgroundColor: RED, alignItems: "center", justifyContent: "center", shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 },
});
