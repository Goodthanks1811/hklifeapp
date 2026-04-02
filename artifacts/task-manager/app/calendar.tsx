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

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG       = "#0b0b0c";
const SHEET_BG = "#141416";
const CARD     = "#1e1e20";
const CARD2    = "#252528";
const BORDER   = "rgba(255,255,255,0.07)";
const BORD2    = "rgba(255,255,255,0.11)";
const RED      = "#ff2020";
const RED_DIM  = "rgba(255,32,32,0.16)";
const RED_BORD = "rgba(255,32,32,0.5)";
const TEXT     = "#f0f0f0";
const TEXT2    = "#888";
const TEXT3    = "#444";

const HK_BG    = "rgba(30,120,255,0.18)";
const HK_BR    = "rgba(30,120,255,0.65)";
const HK_TX    = "#5aa5ff";
const ST_BG    = "rgba(255,30,30,0.18)";
const ST_BR    = "rgba(255,30,30,0.65)";
const ST_TX    = "#ff5555";

// ── Calendar data ─────────────────────────────────────────────────────────────
const DAYS_AHEAD = 60;
const ALLOWED    = ["hk", "birthday", "sticky", "ele"];
const DAYS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS_S   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_L   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_U   = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DOW_H      = ["S","M","T","W","T","F","S"];

// ── Pickers ───────────────────────────────────────────────────────────────────
const HOURS_W   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES_W = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPM_W    = ["AM", "PM"];

const DURATIONS = [
  { label: "30m", mins: 30  },
  { label: "1hr", mins: 60  },
  { label: "2hr", mins: 120 },
  { label: "3hr", mins: 180 },
  { label: "4hr", mins: 240 },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalEvent   { id: string; title: string; timeStr: string | null; }
interface DaySection { dateKey: string; dayLabel: string; ordStr: string; isToday: boolean; data: CalEvent[]; }
type EventType = "appointment" | "allday" | "birthday";
type CalKey    = "HK" | "Sticky";

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
function isoDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function keepCal(title: string) {
  const t = title.trim().toLowerCase();
  return ALLOWED.some(a => t === a);
}
function normalDay(d: Date): Date {
  const n = new Date(d); n.setHours(0, 0, 0, 0); return n;
}

// ── DrumWheel ─────────────────────────────────────────────────────────────────
const DW_ITEM = 44;
const DW_VIS  = 3;

function DrumWheel({
  items, selectedIndex, onChange, width = 68,
}: {
  items: string[]; selectedIndex: number; onChange: (i: number) => void; width?: number;
}) {
  const ref      = useRef<ScrollView>(null);
  const dragging = useRef(false);

  const scrollTo = useCallback((i: number, animated = true) => {
    ref.current?.scrollTo({ y: i * DW_ITEM, animated });
  }, []);

  const mounted = useRef(false);
  const onLayout = useCallback(() => {
    if (!mounted.current) { mounted.current = true; scrollTo(selectedIndex, false); }
  }, [selectedIndex, scrollTo]);

  const snap = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(
      items.length - 1,
      Math.round(e.nativeEvent.contentOffset.y / DW_ITEM),
    ));
    onChange(idx);
    scrollTo(idx);
    Haptics.selectionAsync();
  }, [items.length, onChange, scrollTo]);

  return (
    <View style={[dw.wrap, { width }]}>
      <View style={dw.highlight} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={DW_ITEM}
        decelerationRate="fast"
        onLayout={onLayout}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onMomentumScrollEnd={e => { dragging.current = false; snap(e); }}
        onScrollEndDrag={e => { if (!dragging.current) snap(e); }}
        scrollEventThrottle={16}
      >
        {[...[""], ...items, ...[""]].map((item, i) => {
          const real = i - 1;
          const sel  = real === selectedIndex && item !== "";
          return (
            <Pressable key={i}
              style={{ height: DW_ITEM, alignItems: "center", justifyContent: "center" }}
              onPress={() => { if (!item) return; onChange(real); scrollTo(real); Haptics.selectionAsync(); }}
            >
              <Text style={[dw.txt, sel && dw.txtSel, !item && { opacity: 0 }]}>{item || "·"}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={dw.fadeT} pointerEvents="none" />
      <View style={dw.fadeB} pointerEvents="none" />
    </View>
  );
}

const dw = StyleSheet.create({
  wrap: {
    height: DW_ITEM * DW_VIS, borderRadius: 10, overflow: "hidden",
    backgroundColor: CARD2, borderWidth: 1, borderColor: BORD2,
  },
  highlight: {
    position: "absolute", left: 0, right: 0,
    top: DW_ITEM, height: DW_ITEM,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.1)", zIndex: 1,
  },
  txt:   { color: "#4a4a4e", fontSize: 18, fontFamily: "Inter_400Regular" },
  txtSel:{ color: "#fff",    fontSize: 20, fontFamily: "Inter_700Bold" },
  fadeT: {
    position: "absolute", top: 0, left: 0, right: 0, height: DW_ITEM,
    backgroundColor: CARD2, opacity: 0.85, zIndex: 2, pointerEvents: "none",
  },
  fadeB: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: DW_ITEM,
    backgroundColor: CARD2, opacity: 0.85, zIndex: 2, pointerEvents: "none",
  },
});

// ── MonthCalendar ─────────────────────────────────────────────────────────────
function MonthCalendar({
  selected, onChange,
}: {
  selected: Date; onChange: (d: Date) => void;
}) {
  const today = normalDay(new Date());
  const [vy, setVy] = useState(selected.getFullYear());
  const [vm, setVm] = useState(selected.getMonth());

  const prevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (vm === 0) { setVy(y => y - 1); setVm(11); } else setVm(m => m - 1);
  };
  const nextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (vm === 11) { setVy(y => y + 1); setVm(0); } else setVm(m => m + 1);
  };

  const firstDow   = new Date(vy, vm, 1).getDay();
  const daysInMon  = new Date(vy, vm + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Math.ceil(cells.length / 7);

  const isSel  = (d: number) => selected.getFullYear() === vy && selected.getMonth() === vm && selected.getDate() === d;
  const isToday = (d: number) => today.getFullYear() === vy && today.getMonth() === vm && today.getDate() === d;
  const isPast  = (d: number) => normalDay(new Date(vy, vm, d)) < today;

  const pick = (d: number) => {
    const n = new Date(vy, vm, d); n.setHours(0, 0, 0, 0);
    onChange(n);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={mc.wrap}>
      {/* Month nav */}
      <View style={mc.nav}>
        <Pressable onPress={prevMonth} hitSlop={14} style={mc.navBtn}>
          <Feather name="chevron-left" size={16} color={TEXT2} />
        </Pressable>
        <Text style={mc.navLabel}>{MONTHS_L[vm]} {vy}</Text>
        <Pressable onPress={nextMonth} hitSlop={14} style={mc.navBtn}>
          <Feather name="chevron-right" size={16} color={TEXT2} />
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={mc.dowRow}>
        {DOW_H.map((d, i) => <Text key={i} style={mc.dow}>{d}</Text>)}
      </View>

      {/* Day grid */}
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={mc.week}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={mc.cell} />;
            const sel  = isSel(day);
            const tod  = isToday(day);
            const past = isPast(day);
            return (
              <Pressable key={col} onPress={() => pick(day)}
                style={[mc.cell, sel && mc.cellSel, tod && !sel && mc.cellToday]}
              >
                <Text style={[
                  mc.dayTxt,
                  sel  && mc.dayTxtSel,
                  tod  && !sel && mc.dayTxtToday,
                  past && !sel && mc.dayTxtPast,
                ]}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CELL_SIZE = Math.floor((Dimensions.get("window").width - 40 - 32) / 7); // sheet padding 20 + inner 16

const mc = StyleSheet.create({
  wrap: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORD2,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 0,
  },
  nav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 14, paddingBottom: 8,
  },
  navBtn:   { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  navLabel: { color: TEXT, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dowRow:   { flexDirection: "row", marginBottom: 4 },
  dow:      { width: CELL_SIZE, textAlign: "center", color: TEXT3, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  week:     { flexDirection: "row" },
  cell:     { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center" },
  cellSel:  { backgroundColor: RED, borderRadius: CELL_SIZE / 2 },
  cellToday:{ borderWidth: 1.5, borderColor: RED, borderRadius: CELL_SIZE / 2 },
  dayTxt:      { color: TEXT, fontSize: 14, fontFamily: "Inter_400Regular" },
  dayTxtSel:   { color: "#fff", fontFamily: "Inter_700Bold" },
  dayTxtToday: { color: RED },
  dayTxtPast:  { color: TEXT3 },
});

// ── AddEventSheet ─────────────────────────────────────────────────────────────
function AddEventSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();

  const [title,   setTitle]   = useState("");
  const [date,    setDate]    = useState(() => normalDay(new Date()));
  const [evType,  setEvType]  = useState<EventType | null>(null);
  const [hourIdx, setHourIdx] = useState(8);
  const [minIdx,  setMinIdx]  = useState(0);
  const [ampmIdx, setAmpmIdx] = useState(0);
  const [durMins, setDurMins] = useState(-1);
  const [calKey,  setCalKey]  = useState<CalKey>("HK");
  const [saving,  setSaving]  = useState(false);
  const [errMsg,  setErrMsg]  = useState("");

  const slideY = useRef(new Animated.Value(700)).current;
  const scrimO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 30, stiffness: 300, overshootClamping: true }),
      Animated.timing(scrimO, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [slideY, scrimO]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 750, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scrimO, { toValue: 0,   duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onClose());
  }, [slideY, scrimO, onClose]);

  const save = async () => {
    if (!title.trim() || !evType) return;
    if (evType === "appointment" && durMins < 0) return;
    setSaving(true); setErrMsg("");
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") throw new Error("Calendar access required — enable it in Settings.");

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
        await Calendar.createEventAsync(targetId, { title: title.trim(), startDate: dayStart, endDate: dayEnd, allDay: true });
      } else if (evType === "birthday") {
        await Calendar.createEventAsync(targetId, {
          title: title.trim(), startDate: dayStart, endDate: dayEnd, allDay: true,
          recurrenceRule: { frequency: Calendar.Frequency.YEARLY, interval: 1 },
          alarms: [{ relativeOffset: 330 }],
        });
      } else {
        const h = parseInt(HOURS_W[hourIdx], 10);
        const h24 = ampmIdx === 1 ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
        const startDate = new Date(date); startDate.setHours(h24, parseInt(MINUTES_W[minIdx], 10), 0, 0);
        const endDate   = new Date(startDate.getTime() + durMins * 60000);
        await Calendar.createEventAsync(targetId, { title: title.trim(), startDate, endDate, allDay: false });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch (e: any) {
      setErrMsg(e?.message ?? "Failed to create event.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = title.trim().length > 0 && evType !== null
    && (evType !== "appointment" || durMins >= 0);

  const TYPE_PILLS: { key: EventType; icon: string; label: string }[] = [
    { key: "appointment", icon: "🕒", label: "Appointment" },
    { key: "allday",      icon: "📆", label: "All Day"     },
    { key: "birthday",    icon: "🎂", label: "Birthday"    },
  ];

  return (
    <>
      <Animated.View style={[sh.scrim, { opacity: scrimO }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View style={[sh.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={sh.handle} />

        {/* Header */}
        <View style={sh.header}>
          <Text style={sh.headerTitle}>New Event</Text>
          <Pressable onPress={close} hitSlop={14} style={sh.closeBtn}>
            <Feather name="x" size={17} color={TEXT2} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={sh.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Title ─────────────────────────────────────────────────────── */}
          <TextInput
            style={sh.titleInput}
            placeholder="Event title…"
            placeholderTextColor={TEXT3}
            value={title}
            onChangeText={setTitle}
            returnKeyType="done"
            selectionColor={RED}
            autoFocus
          />

          {/* ── Date calendar ─────────────────────────────────────────────── */}
          <MonthCalendar selected={date} onChange={setDate} />

          {/* ── Type ──────────────────────────────────────────────────────── */}
          <View style={sh.row}>
            {TYPE_PILLS.map(tp => {
              const active = evType === tp.key;
              return (
                <Pressable key={tp.key}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEvType(tp.key); }}
                  style={[sh.typePill, active && sh.typePillActive]}
                >
                  <Text style={sh.typePillIcon}>{tp.icon}</Text>
                  <Text style={[sh.typePillLabel, active && sh.typePillLabelActive]}>{tp.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Appointment card: time + duration ─────────────────────────── */}
          {evType === "appointment" && (
            <View style={sh.apptCard}>
              {/* Time */}
              <View style={sh.apptSection}>
                <Text style={sh.apptSub}>Start Time</Text>
                <View style={sh.drumRow}>
                  <DrumWheel items={HOURS_W}   selectedIndex={hourIdx}  onChange={setHourIdx}  width={68} />
                  <Text style={sh.drumColon}>:</Text>
                  <DrumWheel items={MINUTES_W} selectedIndex={minIdx}   onChange={setMinIdx}   width={68} />
                  <DrumWheel items={AMPM_W}    selectedIndex={ampmIdx}  onChange={setAmpmIdx}  width={60} />
                </View>
              </View>

              <View style={sh.apptDivider} />

              {/* Duration */}
              <View style={sh.apptSection}>
                <Text style={sh.apptSub}>Duration</Text>
                <View style={sh.durRow}>
                  {DURATIONS.map(d => {
                    const active = durMins === d.mins;
                    return (
                      <Pressable key={d.label}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDurMins(d.mins); }}
                        style={[sh.durPill, active && sh.durPillActive]}
                      >
                        <Text style={[sh.durPillTxt, active && sh.durPillTxtActive]}>{d.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* ── Calendar pills ─────────────────────────────────────────────── */}
          {evType !== null && evType !== "birthday" && (
            <View style={sh.row}>
              {(["HK", "Sticky"] as CalKey[]).map(k => {
                const active = calKey === k;
                const isHK   = k === "HK";
                return (
                  <Pressable key={k}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCalKey(k); }}
                    style={[
                      sh.calPill,
                      { backgroundColor: active ? (isHK ? HK_BG : ST_BG) : CARD,
                        borderColor:      active ? (isHK ? HK_BR : ST_BR) : BORD2 },
                    ]}
                  >
                    <View style={[sh.calDot, { backgroundColor: isHK ? HK_TX : ST_TX }]} />
                    <Text style={[sh.calPillTxt, { color: active ? (isHK ? HK_TX : ST_TX) : TEXT2 }]}>{k}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── Error ─────────────────────────────────────────────────────── */}
          {errMsg !== "" && (
            <View style={sh.errRow}>
              <Feather name="alert-circle" size={13} color={RED} />
              <Text style={sh.errTxt}>{errMsg}</Text>
            </View>
          )}
        </ScrollView>

        {/* ── Save ──────────────────────────────────────────────────────────── */}
        <Pressable
          onPress={save}
          disabled={!canSave || saving}
          style={({ pressed }) => [sh.saveBtn, (!canSave || saving) && sh.saveBtnDim, pressed && canSave && { opacity: 0.8 }]}
        >
          <Text style={sh.saveBtnTxt}>{saving ? "Saving…" : "Save Event"}</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

// ── Sheet styles ───────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 200 },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 201,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    maxHeight: "90%",
  },
  handle: {
    alignSelf: "center", width: 36, height: 4, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.15)", marginTop: 10, marginBottom: 0,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: { color: TEXT, fontSize: 16, fontFamily: "Inter_700Bold" },
  closeBtn: { position: "absolute", right: 20, width: 32, height: 32, alignItems: "center", justifyContent: "center" },

  scroll:     { padding: 20, gap: 14 },

  titleInput: {
    backgroundColor: CARD, borderWidth: 1.5, borderColor: BORD2,
    borderRadius: 13, color: TEXT, fontSize: 17, fontFamily: "Inter_400Regular",
    paddingHorizontal: 16, paddingVertical: 14,
  },

  // Type pills
  row: { flexDirection: "row", gap: 8 },
  typePill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, backgroundColor: CARD, borderWidth: 1.5, borderColor: BORD2,
    borderRadius: 12, paddingVertical: 13,
  },
  typePillActive: { backgroundColor: RED_DIM, borderColor: RED_BORD },
  typePillIcon:   { fontSize: 16 },
  typePillLabel:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT2 },
  typePillLabelActive: { color: "#ff8080" },

  // Appointment card
  apptCard: {
    backgroundColor: CARD, borderWidth: 1.5, borderColor: BORD2, borderRadius: 14, overflow: "hidden",
  },
  apptSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  apptDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 0 },
  apptSub: { color: TEXT2, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 10 },
  drumRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  drumColon: { color: "#4a4a4e", fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 2, lineHeight: 28 },
  durRow: { flexDirection: "row", gap: 6 },
  durPill: {
    flex: 1, backgroundColor: CARD2, borderWidth: 1.5, borderColor: BORD2,
    borderRadius: 9, paddingVertical: 9, alignItems: "center",
  },
  durPillActive: { backgroundColor: RED_DIM, borderColor: RED_BORD },
  durPillTxt:    { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT2 },
  durPillTxtActive: { color: "#ff8080" },

  // Calendar pills
  calPill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14,
  },
  calDot:    { width: 8, height: 8, borderRadius: 4 },
  calPillTxt:{ fontSize: 15, fontFamily: "Inter_700Bold" },

  // Error
  errRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errTxt: { color: RED, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },

  // Save
  saveBtn: {
    marginHorizontal: 20, marginTop: 10,
    backgroundColor: RED, borderRadius: 14, paddingVertical: 15,
    alignItems: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  saveBtnDim: { opacity: 0.35, shadowOpacity: 0 },
  saveBtnTxt: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
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
  const [showSheet,  setShowSheet]  = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const { status: perm } = await Calendar.requestCalendarPermissionsAsync();
      if (perm !== "granted") { setErrorMsg("Calendar access required. Enable in Settings."); setStatus("error"); return; }

      const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const hkCals  = allCals.filter(c => keepCal(c.title));
      if (!hkCals.length) { setSections([]); setStatus("done"); return; }

      const today   = new Date(); today.setHours(0, 0, 0, 0);
      const endDate = new Date(today); endDate.setDate(today.getDate() + DAYS_AHEAD);
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

      const raw = await Calendar.getEventsAsync(hkCals.map(c => c.id), today, endDate);
      raw.sort((a, b) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime());

      const dayMap = new Map<string, DaySection>();
      for (const ev of raw) {
        if (!ev.title) continue;
        const start      = new Date(ev.startDate as any);
        const key        = isoDay(start);
        const isBirthday = hkCals.find(c => c.id === ev.calendarId)?.title.toLowerCase() === "birthday";
        const title      = isBirthday ? `🎂 ${ev.title}` : ev.title;
        const timeStr    = ev.allDay ? null : fmt12(start);

        if (!dayMap.has(key)) {
          const isToday    = start.toDateString() === today.toDateString();
          const isTomorrow = start.toDateString() === tomorrow.toDateString();
          dayMap.set(key, {
            dateKey:  key,
            dayLabel: isToday ? "Today" : isTomorrow ? "Tomorrow" : DAYS_FULL[start.getDay()],
            ordStr:   `${ordinal(start.getDate())} ${MONTHS_S[start.getMonth()]}`,
            isToday,
            data: [],
          });
        }
        dayMap.get(key)!.data.push({ id: ev.id, title, timeStr });
      }
      setSections(Array.from(dayMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey)));
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
    <View style={[s.dayHdr, section.isToday && s.dayHdrToday]}>
      <Text style={s.dlDay}>{section.dayLabel}</Text>
      <Text style={s.dlSep}>·</Text>
      <Text style={s.dlDate}>{section.ordStr}</Text>
    </View>
  ), []);

  const renderItem = useCallback(({ item, index }: { item: CalEvent; index: number }) => (
    <View style={[s.evRow, index > 0 && s.evRowBorder]}>
      <View style={s.evTime}>
        {item.timeStr ? <Text style={s.tStart}>{item.timeStr}</Text> : null}
      </View>
      <View style={s.evCenter}>
        <Text style={s.evTitle}>{item.title}</Text>
      </View>
      <View style={s.evSpacer} />
    </View>
  ), []);

  const renderSectionFooter = useCallback(() => <View style={s.dayFooter} />, []);

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={s.topBar}>
        <Pressable onPress={toggleDrawer} hitSlop={12} style={s.hamburger}>
          <View style={[s.hLine, { width: 22 }]} />
          <View style={[s.hLine, { width: 15 }]} />
          <View style={[s.hLine, { width: 22 }]} />
        </Pressable>
        <Text style={s.hdrMonth}>{monthLabel}</Text>
      </View>

      {status === "loading" && !refreshing && (
        <>
          <View style={s.inlineTitle}><TitleText /></View>
          <View style={s.center}><Spinner /></View>
        </>
      )}

      {status === "error" && (
        <>
          <View style={s.inlineTitle}><TitleText /></View>
          <View style={s.center}>
            <Feather name="alert-circle" size={28} color={RED} style={{ marginBottom: 8 }} />
            <Text style={s.errorText}>{errorMsg}</Text>
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
          ListHeaderComponent={<View style={s.inlineTitle}><TitleText /></View>}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="calendar" size={32} color="rgba(255,255,255,0.22)" />
              <Text style={s.emptyText}>No upcoming events</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: botPad + 80 }}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}

      {/* FAB */}
      {!showSheet && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowSheet(true); }}
          style={({ pressed }) => [s.fab, pressed && { opacity: 0.82 }]}
        >
          <Feather name="plus" size={22} color="#fff" />
        </Pressable>
      )}

      {/* Sheet */}
      {showSheet && (
        <AddEventSheet
          onClose={() => setShowSheet(false)}
          onSaved={() => { setShowSheet(false); setStatus("loading"); fetchEvents(); }}
        />
      )}
    </View>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function TitleText() {
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
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [rot]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={[s.spinner, { transform: [{ rotate: spin }] }]} />;
}

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 13, backgroundColor: BG,
  },
  hamburger: { gap: 5 },
  hLine:     { height: 1.5, backgroundColor: TEXT, borderRadius: 2 },
  hdrTitle:  { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.8, lineHeight: 32 },
  hdrMonth:  { fontSize: 11, color: TEXT2, fontFamily: "Inter_400Regular", letterSpacing: 1.2 },
  inlineTitle: {
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: BG, alignItems: "center",
  },
  dayHdr: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "center",
    gap: 6, paddingTop: 14, paddingBottom: 5, paddingHorizontal: 22,
    backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  dayHdrToday: { backgroundColor: "#0d0d0f" },
  dlDay:  { fontSize: 16, fontFamily: "Inter_600SemiBold", color: RED, letterSpacing: -0.2 },
  dlSep:  { fontSize: 14, color: "rgba(255,32,32,0.3)" },
  dlDate: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: RED, letterSpacing: -0.2 },
  dayFooter: { height: 10, backgroundColor: BG },
  evRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 9, paddingHorizontal: 22, backgroundColor: BG,
  },
  evRowBorder: { borderTopWidth: 1, borderTopColor: BORDER },
  evTime:   { width: 56, flexShrink: 0 },
  tStart:   { fontSize: 13, fontFamily: "Inter_500Medium", color: "#fff" },
  evCenter: { flex: 1, alignItems: "center" },
  evTitle:  { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT, lineHeight: 20, textAlign: "center" },
  evSpacer: { width: 56, flexShrink: 0 },
  center:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 32 },
  errorText:{ color: TEXT2, fontSize: 14, textAlign: "center", fontFamily: "Inter_400Regular", lineHeight: 20 },
  retryBtn: { backgroundColor: RED, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, marginTop: 4 },
  retryTxt: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  empty:    { alignItems: "center", marginTop: 64, gap: 12 },
  emptyText:{ color: TEXT2, fontSize: 14, fontFamily: "Inter_400Regular" },
  spinner: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 5, borderColor: "rgba(255,32,32,0.14)", borderTopColor: RED,
  },
  fab: {
    position: "absolute", bottom: 32, right: 20,
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: RED, alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
});
