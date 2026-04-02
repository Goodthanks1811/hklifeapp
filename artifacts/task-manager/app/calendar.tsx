import { Feather } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/context/DrawerContext";

// ── Config ────────────────────────────────────────────────────────────────────
const DAYS_AHEAD = 60;
const ALLOWED    = ["hk", "birthday", "sticky", "ele"];
const BG         = "#0b0b0c";
const BORDER     = "rgba(255,255,255,0.07)";
const RED        = "#ff1e1e";
const TEXT       = "#efefef";
const SUB        = "#999";

const DAYS_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS_S    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_U    = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalEvent {
  id:      string;
  title:   string;
  timeStr: string | null;
}
interface DaySection {
  dateKey:  string;
  dayLabel: string;
  ordStr:   string;
  isToday:  boolean;
  data:     CalEvent[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function ordinal(n: number) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function CalendarScreen() {
  const insets   = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [status,     setStatus]     = useState<"idle"|"loading"|"error"|"done">("idle");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [sections,   setSections]   = useState<DaySection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [monthLabel, setMonthLabel] = useState(() => MONTHS_U[new Date().getMonth()]);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    try {
      const { status: perm } = await Calendar.requestCalendarPermissionsAsync();
      if (perm !== "granted") {
        setErrorMsg("Calendar access is required. Please allow it in Settings.");
        setStatus("error");
        return;
      }
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
            data:     [],
          });
        }
        dayMap.get(key)!.data.push({ id: ev.id, title, timeStr });
      }
      setSections(Array.from(dayMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey)));
      setStatus("done");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load calendar events");
      setStatus("error");
    }
  }, []);

  useEffect(() => { setStatus("loading"); fetchEvents(); }, [fetchEvents]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  }, [fetchEvents]);

  // ── month pill tracking ────────────────────────────────────────────────────
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 10 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const first = viewableItems.find((v: any) => v.isViewable && v.section?.dateKey);
    if (first?.section?.dateKey) {
      const month = parseInt(first.section.dateKey.split("-")[1], 10) - 1;
      setMonthLabel(MONTHS_U[month]);
    }
  }).current;

  // ── renders ────────────────────────────────────────────────────────────────
  const renderSectionHeader = useCallback(({ section }: { section: DaySection }) => (
    <View style={[s.dayHdr, section.isToday && s.dayHdrToday]}>
      <Text style={s.dlDay}>{section.dayLabel}</Text>
      <Text style={s.dlSep}>·</Text>
      <Text style={s.dlDate}>{section.ordStr}</Text>
    </View>
  ), []);

  const renderItem = useCallback(({ item, index }: { item: CalEvent; index: number; section: DaySection }) => (
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

  const renderSectionFooter = useCallback(() => (
    <View style={s.dayFooter} />
  ), []);

  // ── screen ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: topPad }]}>

      {/* ── Top bar — hamburger only, black ── */}
      <View style={s.header}>
        <Pressable onPress={toggleDrawer} hitSlop={12} style={s.hamburger}>
          <View style={[s.hLine, { width: 22 }]} />
          <View style={[s.hLine, { width: 15 }]} />
          <View style={[s.hLine, { width: 22 }]} />
        </Pressable>

        <Text style={s.hdrMonth}>{monthLabel}</Text>
      </View>

      {/* ── Loading ── */}
      {status === "loading" && !refreshing && (
        <>
          <View style={s.inlineTitle}>
            <Text style={s.hdrTitle}>
              <Text style={{ color: "#fff" }}>HK </Text>
              <Text style={{ color: RED }}>Calendar</Text>
            </Text>
          </View>
          <View style={s.center}>
            <Spinner />
          </View>
        </>
      )}

      {/* ── Error ── */}
      {status === "error" && (
        <>
          <View style={s.inlineTitle}>
            <Text style={s.hdrTitle}>
              <Text style={{ color: "#fff" }}>HK </Text>
              <Text style={{ color: RED }}>Calendar</Text>
            </Text>
          </View>
          <View style={s.center}>
            <Feather name="alert-circle" size={28} color={RED} style={{ marginBottom: 8 }} />
            <Text style={s.errorText}>{errorMsg}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setStatus("loading"); fetchEvents(); }}>
              <Text style={s.retryText}>Try Again</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ── List ── */}
      {status === "done" && (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          renderItem={renderItem}
          stickySectionHeadersEnabled
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={RED} />}
          ListHeaderComponent={
            <View style={s.inlineTitle}>
              <Text style={s.hdrTitle}>
                <Text style={{ color: "#fff" }}>HK </Text>
                <Text style={{ color: RED }}>Calendar</Text>
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="calendar" size={32} color="rgba(255,255,255,0.22)" />
              <Text style={s.emptyText}>No upcoming events</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: botPad + 28 }}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}
    </View>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 13,
    backgroundColor: BG,
  },
  hamburger: { gap: 5 },
  hLine:     { height: 1.5, backgroundColor: TEXT, borderRadius: 2 },
  hdrTitle:  { fontSize: 26, fontWeight: "800", fontFamily: "Inter_700Bold", letterSpacing: -0.8, lineHeight: 32 },
  hdrMonth:  { fontSize: 11, color: SUB, fontFamily: "Inter_400Regular", letterSpacing: 1.2, minWidth: 32, textAlign: "right" },
  inlineTitle: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: BG,
    alignItems: "center",
  },

  // Day header (sticky)
  dayHdr: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    paddingTop: 14,
    paddingBottom: 5,
    paddingHorizontal: 22,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  dayHdrToday: { backgroundColor: "#0d0d0f" },
  dlDay:  { fontSize: 16, fontWeight: "600", color: RED, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },
  dlSep:  { fontSize: 14, color: "rgba(255,30,30,0.35)" },
  dlDate: { fontSize: 16, fontWeight: "600", color: RED, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },

  // Section footer gap
  dayFooter: { height: 10, backgroundColor: BG },

  // Event rows
  evRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 22,
    backgroundColor: BG,
  },
  evRowBorder: { borderTopWidth: 1, borderTopColor: BORDER },
  evTime:    { width: 56, flexShrink: 0 },
  tStart:    { fontSize: 13, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
  evCenter:  { flex: 1, alignItems: "center" },
  evTitle:   { fontSize: 15, fontWeight: "700", color: TEXT, fontFamily: "Inter_700Bold", lineHeight: 20, textAlign: "center" },
  evSpacer:  { width: 56, flexShrink: 0 },

  // States
  center:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 32 },
  errorText: { color: SUB, fontSize: 14, textAlign: "center", fontFamily: "Inter_400Regular", lineHeight: 20 },
  retryBtn:  { backgroundColor: RED, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, marginTop: 4 },
  retryText: { color: "#fff", fontWeight: "800", fontFamily: "Inter_700Bold", fontSize: 15 },
  empty:     { alignItems: "center", marginTop: 64, gap: 12 },
  emptyText: { color: SUB, fontSize: 14, fontFamily: "Inter_400Regular" },

  // Spinner
  spinner: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 5,
    borderColor: "rgba(255,30,30,0.14)",
    borderTopColor: RED,
  },
});
