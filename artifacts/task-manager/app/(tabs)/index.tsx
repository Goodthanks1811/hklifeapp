import { Feather } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/context/DrawerContext";

// ── Config ─────────────────────────────────────────────────────────────────
const DAYS_AHEAD = 60;
const MAX_EVENTS = 250;
const HEADER_IMG = "https://i.postimg.cc/zXn6mWdH/IMG-9454.png";
const EXCLUDE_EXACT = ["australian holidays", "holidays in australia", "birthdays"];

// ── Theme ───────────────────────────────────────────────────────────────────
const T = {
  bg:       "#0a0a0e",
  card:     "#15151c",
  cardDeep: "#0e0e14",
  stroke:   "rgba(255,255,255,0.09)",
  strokeHi: "rgba(255,255,255,0.14)",
  red:      "#ff2d2d",
  redDeep:  "#c81010",
  blue:     "#3b8bff",
  text:     "#f2f2f7",
  muted:    "rgba(242,242,247,0.42)",
  dim:      "rgba(242,242,247,0.22)",
};

// ── Types ────────────────────────────────────────────────────────────────────
interface CalEvent {
  id:        string;
  title:     string;
  timeStr:   string;
  isAllDay:  boolean;
  startDate: Date;
  endDate:   Date;
  calId:     string;
}
interface DayGroup {
  dateKey:   string;
  dayHeader: string;
  isToday:   boolean;
  isFuture:  boolean;
  items:     CalEvent[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) { case 1: return `${n}st`; case 2: return `${n}nd`; case 3: return `${n}rd`; default: return `${n}th`; }
}
function fmtDayHeader(d: Date) {
  return `${d.toLocaleDateString("en-GB", { weekday: "long" })} ${ordinal(d.getDate())} ${d.toLocaleDateString("en-GB", { month: "short" })}`;
}
function fmtTime(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function isoDay(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function keepCal(title: string) {
  const t = title.trim().toLowerCase();
  return t.includes("hk") || t.includes("sticky");
}
function isExcluded(title: string) {
  return EXCLUDE_EXACT.includes(title.trim().toLowerCase());
}

// ── Component ────────────────────────────────────────────────────────────────
export default function HKCalendarScreen() {
  const insets  = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const { width: screenW } = useWindowDimensions();
  const isTablet = screenW >= 768;

  const [status,     setStatus]     = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMsg,   setErrorMsg]   = useState("");
  const [groups,     setGroups]     = useState<DayGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet,      setSheet]      = useState<CalEvent | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const sheetY  = useRef(new Animated.Value(340)).current;
  const scrimOp = useRef(new Animated.Value(0)).current;

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;
  const contentW  = isTablet ? Math.min(screenW * 0.72, 720) : undefined;

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    try {
      const { status: perm } = await Calendar.requestCalendarPermissionsAsync();
      if (perm !== "granted") {
        setErrorMsg("Calendar access is required. Please allow it in Settings.");
        setStatus("error");
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const hkCals = calendars.filter((c) => keepCal(c.title) && !isExcluded(c.title));

      if (!hkCals.length) { setGroups([]); setStatus("done"); return; }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + DAYS_AHEAD);

      const raw = await Calendar.getEventsAsync(hkCals.map((c) => c.id), today, endDate);
      raw.sort((a, b) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime());

      const dayMap = new Map<string, DayGroup>();
      let count = 0;
      for (const ev of raw) {
        if (count >= MAX_EVENTS) break;
        if (!ev.title) continue;
        const start   = new Date(ev.startDate as any);
        const end     = new Date(ev.endDate as any);
        const key     = isoDay(start);
        const timeStr = ev.allDay ? "All day" : `${fmtTime(start)} – ${fmtTime(end)}`;
        if (!dayMap.has(key)) {
          dayMap.set(key, {
            dateKey:   key,
            dayHeader: fmtDayHeader(start),
            isToday:   sameDay(start, today),
            isFuture:  start.getTime() > today.getTime(),
            items:     [],
          });
        }
        dayMap.get(key)!.items.push({ id: ev.id, title: ev.title, timeStr, isAllDay: !!ev.allDay, startDate: start, endDate: end, calId: ev.calendarId });
        count++;
      }
      setGroups(Array.from(dayMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey)));
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

  // ── sheet ──────────────────────────────────────────────────────────────────
  const openSheet = useCallback((ev: CalEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSheet(ev);
    setSheetVisible(true);
    setDeleting(false);
    sheetY.setValue(340);
    scrimOp.setValue(0);
    Animated.parallel([
      Animated.timing(sheetY,  { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scrimOp, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [sheetY, scrimOp]);

  const closeSheet = useCallback((then?: () => void) => {
    Animated.parallel([
      Animated.timing(sheetY,  { toValue: 340, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scrimOp, { toValue: 0,   duration: 180, useNativeDriver: true }),
    ]).start(() => { setSheetVisible(false); setSheet(null); then?.(); });
  }, [sheetY, scrimOp]);

  const handleDelete = useCallback(() => {
    if (!sheet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setDeleting(true);
    closeSheet(async () => {
      try {
        await Calendar.deleteEventAsync(sheet.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await fetchEvents();
      } catch {}
      setDeleting(false);
    });
  }, [sheet, closeSheet, fetchEvents]);

  // ── list data ──────────────────────────────────────────────────────────────
  type ListItem =
    | { type: "group-start"; group: DayGroup }
    | { type: "event"; event: CalEvent; isToday: boolean };

  const listData = React.useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    for (const g of groups) {
      out.push({ type: "group-start", group: g });
      for (const ev of g.items) out.push({ type: "event", event: ev, isToday: g.isToday });
    }
    return out;
  }, [groups]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === "group-start") {
      const { group } = item;
      return (
        <View style={[styles.dayGroup, group.isToday && styles.dayGroupToday]}>
          {group.isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
          <Text style={styles.dayHeader}>{group.dayHeader}</Text>
        </View>
      );
    }
    const { event, isToday } = item;
    return (
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={() => openSheet(event)}
        style={[styles.eventCard, isToday && styles.eventCardToday]}
      >
        <View style={styles.eventTimeWrap}>
          <Text style={styles.eventTime} numberOfLines={2}>{event.timeStr}</Text>
        </View>
        <View style={styles.eventDivider} />
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
      </TouchableOpacity>
    );
  }, [openSheet]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Hamburger */}
      <Pressable onPress={() => openDrawer()} style={[styles.hamburgerBtn, { top: topPad + 10 }]}>
        <Feather name="menu" size={20} color={T.text} />
      </Pressable>

      {status === "loading" && !refreshing && (
        <View style={styles.centerWrap}>
          <SpinnerView />
          <Text style={styles.loadingText}>Loading calendar…</Text>
        </View>
      )}

      {status === "error" && (
        <View style={styles.centerWrap}>
          <View style={styles.errorIcon}>
            <Feather name="alert-circle" size={28} color={T.red} />
          </View>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setStatus("loading"); fetchEvents(); }}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "done" && (
        <FlatList
          data={listData}
          keyExtractor={(item, i) =>
            item.type === "group-start" ? `g-${item.group.dateKey}` : `e-${item.event.id}-${i}`
          }
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={T.red} />}
          ListHeaderComponent={
            <View style={[styles.listHeader, contentW ? { maxWidth: contentW } : null]}>
              <Image
                source={{ uri: HEADER_IMG }}
                style={{ width: isTablet ? 300 : 200, height: isTablet ? 84 : 56 }}
                contentFit="contain"
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="calendar" size={32} color={T.dim} />
              <Text style={styles.emptyText}>No upcoming HK/Sticky events</Text>
            </View>
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 28 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Bottom sheet ──────────────────────────────────────────────── */}
      {sheetVisible && (
        <Modal transparent animationType="none" onRequestClose={() => closeSheet()}>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Scrim */}
            <Animated.View style={[styles.scrim, { opacity: scrimOp }]} pointerEvents="auto">
              <TouchableWithoutFeedback onPress={() => closeSheet()}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
            </Animated.View>

            {/* Sheet card */}
            <Animated.View
              style={[styles.sheetWrap, { bottom: 0, paddingBottom: Math.max(bottomPad, 16), transform: [{ translateY: sheetY }] }]}
              pointerEvents="auto"
            >
              {/* Drag handle */}
              <View style={styles.dragHandleWrap}>
                <View style={styles.dragHandle} />
              </View>

              {/* Main card */}
              <View style={styles.sheetCard}>
                {/* Event info */}
                <View style={styles.sheetHead}>
                  <Text style={styles.sheetTitle} numberOfLines={3}>
                    {sheet?.title || "(No title)"}
                  </Text>
                  <View style={styles.sheetTimePill}>
                    <Feather name="clock" size={11} color={T.red} />
                    <Text style={styles.sheetTimeText}>{sheet?.timeStr}</Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.sheetDivider} />

                {/* Action buttons */}
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={styles.btnReschedule}
                    onPress={() => closeSheet()}
                  >
                    <Feather name="calendar" size={16} color="#93c5fd" />
                    <Text style={styles.btnRescheduleText}>Reschedule</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={[styles.btnDelete, deleting && { opacity: 0.5 }]}
                    onPress={handleDelete}
                    disabled={deleting}
                  >
                    <Feather name="trash-2" size={16} color="#fff" />
                    <Text style={styles.btnDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Cancel — full pill below card */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.btnCancel}
                onPress={() => closeSheet()}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function SpinnerView() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [rot]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  hamburgerBtn: {
    position: "absolute", left: 16, zIndex: 10,
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: T.stroke,
    alignItems: "center", justifyContent: "center",
  },

  // List
  listContent: { paddingHorizontal: 14 },
  listHeader:  { alignSelf: "center", width: "100%", alignItems: "center", paddingTop: 56, paddingBottom: 12 },

  // Day groups
  dayGroup: { marginTop: 28, width: "100%", maxWidth: 720, alignSelf: "center" },
  dayGroupToday: {
    marginTop: 28, paddingTop: 14, paddingHorizontal: 8, paddingBottom: 4,
    borderRadius: 22,
    shadowColor: T.red, shadowOffset: { width: 0, height: 0 },
    shadowRadius: 32, shadowOpacity: 0.30,
    borderWidth: 1, borderColor: "rgba(255,45,45,0.15)",
    backgroundColor: "rgba(255,45,45,0.03)",
  },
  todayBadge: {
    alignSelf: "center", marginBottom: 6,
    backgroundColor: T.red,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3,
    shadowColor: T.red, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.5,
  },
  todayBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.2, fontFamily: "Inter_700Bold" },
  dayHeader: {
    textAlign: "center", fontSize: 19, fontWeight: "900",
    color: T.red, letterSpacing: -0.3, fontFamily: "Inter_700Bold", marginBottom: 14,
  },

  // Event cards
  eventCard: {
    flexDirection: "row", alignItems: "center", gap: 0,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 10, borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1, borderColor: T.stroke,
    width: "100%", maxWidth: 720, alignSelf: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 3,
  },
  eventCardToday: {
    borderColor: "rgba(255,45,45,0.20)",
    backgroundColor: "#17121a",
  },
  eventTimeWrap: { width: 86 },
  eventTime: {
    fontSize: 12, fontWeight: "800",
    color: T.muted, fontFamily: "Inter_700Bold", lineHeight: 17,
  },
  eventDivider: {
    width: 1, height: 28, backgroundColor: T.stroke, marginHorizontal: 12,
  },
  eventTitle: {
    flex: 1, fontSize: 15, fontWeight: "800",
    color: T.text, fontFamily: "Inter_700Bold", lineHeight: 21,
  },

  // Loading / error
  centerWrap:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 32 },
  loadingText: { color: T.muted, fontSize: 14, fontFamily: "Inter_400Regular" },
  errorIcon:   {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: "rgba(255,45,45,0.10)",
    borderWidth: 1, borderColor: "rgba(255,45,45,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  errorText:   { color: T.muted, fontSize: 14, textAlign: "center", fontFamily: "Inter_400Regular", lineHeight: 20 },
  retryBtn: {
    backgroundColor: T.red, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 32,
    shadowColor: T.red, shadowOffset: { width: 0, height: 8 }, shadowRadius: 18, shadowOpacity: 0.40,
  },
  retryText: { color: "#fff", fontWeight: "800", fontFamily: "Inter_700Bold", fontSize: 15 },

  emptyWrap:  { alignItems: "center", marginTop: 48, gap: 12 },
  emptyText:  { color: T.muted, fontSize: 14, fontFamily: "Inter_400Regular" },

  spinner: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 7,
    borderColor: "rgba(255,45,45,0.14)",
    borderTopColor: "rgba(255,45,45,0.95)",
    shadowColor: T.red, shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22, shadowOpacity: 0.35,
  },

  // Sheet
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.60)",
  },
  sheetWrap: {
    position: "absolute", left: 0, right: 0,
    paddingHorizontal: 12,
    backgroundColor: T.bg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: T.strokeHi,
    paddingTop: 12,
  },

  // Drag handle
  dragHandleWrap: { alignItems: "center", paddingBottom: 10 },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
  },

  // Main sheet card
  sheetCard: {
    borderRadius: 24,
    backgroundColor: T.card,
    borderWidth: 1, borderColor: T.strokeHi,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 24 },
    shadowRadius: 48, shadowOpacity: 0.70, elevation: 20,
  },
  sheetHead: {
    paddingTop: 22, paddingHorizontal: 20, paddingBottom: 18,
    alignItems: "center", gap: 10,
  },
  sheetTitle: {
    fontSize: 18, fontWeight: "900",
    color: T.text, lineHeight: 24, textAlign: "center",
    fontFamily: "Inter_700Bold",
  },
  sheetTimePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,45,45,0.10)",
    borderWidth: 1, borderColor: "rgba(255,45,45,0.22)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  sheetTimeText: {
    fontSize: 12, fontWeight: "800",
    color: T.red, fontFamily: "Inter_700Bold",
  },
  sheetDivider: {
    height: 1, backgroundColor: T.stroke, marginHorizontal: 0,
  },
  sheetActions: {
    flexDirection: "row", gap: 10, padding: 16,
  },

  // Reschedule button — solid dark blue
  btnReschedule: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    height: 52, borderRadius: 16,
    backgroundColor: "#1e3a5f",
    borderWidth: 1, borderColor: "rgba(93,165,255,0.35)",
  },
  btnRescheduleText: {
    fontSize: 15, fontWeight: "800", color: "#93c5fd",
    fontFamily: "Inter_700Bold",
  },

  // Delete button — solid red with glow
  btnDelete: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    height: 52, borderRadius: 16,
    backgroundColor: T.red,
    shadowColor: T.red, shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20, shadowOpacity: 0.50, elevation: 8,
  },
  btnDeleteText: {
    fontSize: 15, fontWeight: "800", color: "#fff",
    fontFamily: "Inter_700Bold",
  },

  // Cancel — solid dark pill, separate from main card
  btnCancel: {
    marginTop: 10,
    height: 54, borderRadius: 18,
    backgroundColor: "#1c1c24",
    borderWidth: 1, borderColor: T.strokeHi,
    alignItems: "center", justifyContent: "center",
  },
  btnCancelText: {
    fontSize: 17, fontWeight: "900", color: T.text,
    fontFamily: "Inter_700Bold",
  },
});
