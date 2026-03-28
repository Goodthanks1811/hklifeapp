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
  bg:     "#000000",
  card:   "#0b0b0d",
  stroke: "rgba(255,255,255,0.10)",
  red:    "#ff2d2d",
  text:   "#ffffff",
  muted:  "rgba(255,255,255,0.55)",
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
  const t = title.trim().toLowerCase();
  return EXCLUDE_EXACT.includes(t);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function HKCalendarScreen() {
  const insets  = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const { width: screenW } = useWindowDimensions();
  const isTablet = screenW >= 768;

  const [status,    setStatus]    = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [groups,    setGroups]    = useState<DayGroup[]>([]);
  const [refreshing,setRefreshing]= useState(false);
  const [sheet, setSheet]   = useState<CalEvent | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetY   = useRef(new Animated.Value(300)).current;
  const scrimOp  = useRef(new Animated.Value(0)).current;

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;
  const contentW  = isTablet ? Math.min(screenW * 0.72, 720) : undefined;

  // ── fetch ───────────────────────────────────────────────────────────────
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

      if (!hkCals.length) {
        setGroups([]);
        setStatus("done");
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + DAYS_AHEAD);

      const raw = await Calendar.getEventsAsync(
        hkCals.map((c) => c.id),
        today,
        endDate
      );

      raw.sort((a, b) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime());

      const dayMap = new Map<string, DayGroup>();
      let count = 0;

      for (const ev of raw) {
        if (count >= MAX_EVENTS) break;
        if (!ev.title) continue;
        const start = new Date(ev.startDate as any);
        const end   = new Date(ev.endDate as any);
        const key   = isoDay(start);
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
        dayMap.get(key)!.items.push({
          id:        ev.id,
          title:     ev.title,
          timeStr,
          isAllDay:  !!ev.allDay,
          startDate: start,
          endDate:   end,
          calId:     ev.calendarId,
        });
        count++;
      }

      const sorted = Array.from(dayMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      setGroups(sorted);
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

  // ── sheet ──────────────────────────────────────────────────────────────
  const openSheet = useCallback((ev: CalEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSheet(ev);
    setSheetVisible(true);
    sheetY.setValue(320);
    scrimOp.setValue(0);
    Animated.parallel([
      Animated.timing(sheetY,  { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scrimOp, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [sheetY, scrimOp]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetY,  { toValue: 320, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scrimOp, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { setSheetVisible(false); setSheet(null); });
  }, [sheetY, scrimOp]);

  const handleDelete = useCallback(async () => {
    if (!sheet) return;
    closeSheet();
    try {
      await Calendar.deleteEventAsync(sheet.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchEvents();
    } catch (e: any) {
      // silent — event may have already been deleted
    }
  }, [sheet, closeSheet, fetchEvents]);

  // ── flat list data ──────────────────────────────────────────────────────
  type ListItem =
    | { type: "group-start"; group: DayGroup }
    | { type: "event"; event: CalEvent; isToday: boolean };

  const listData = React.useMemo<ListItem[]>(() => {
    const out: ListItem[] = [];
    for (const g of groups) {
      out.push({ type: "group-start", group: g });
      for (const ev of g.items) {
        out.push({ type: "event", event: ev, isToday: g.isToday });
      }
    }
    return out;
  }, [groups]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === "group-start") {
      const { group } = item;
      return (
        <View style={[styles.dayGroup, group.isToday && styles.dayGroupToday]}>
          <Text style={styles.dayHeader}>{group.dayHeader}</Text>
        </View>
      );
    }
    const { event, isToday } = item;
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => openSheet(event)}
        style={[styles.eventCard, isToday && styles.eventCardToday]}
      >
        <Text style={styles.eventTime} numberOfLines={1}>{event.timeStr}</Text>
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
      </TouchableOpacity>
    );
  }, [openSheet]);

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Hamburger */}
      <Pressable onPress={() => openDrawer()} style={[styles.hamburgerBtn, { top: topPad + 10 }]}>
        <Feather name="menu" size={20} color="rgba(255,255,255,0.85)" />
      </Pressable>

      {status === "loading" && !refreshing && (
        <View style={styles.centerWrap}>
          <SpinnerView />
        </View>
      )}

      {status === "error" && (
        <View style={styles.centerWrap}>
          <Feather name="alert-circle" size={36} color={T.red} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setStatus("loading"); fetchEvents(); }}>
            <Text style={styles.retryText}>Retry</Text>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={T.red}
            />
          }
          ListHeaderComponent={
            <View style={{ alignSelf: "center", width: "100%", maxWidth: contentW, alignItems: "center", paddingTop: 52, paddingBottom: 8 }}>
              <Image
                source={{ uri: HEADER_IMG }}
                style={{ width: isTablet ? 320 : 220, height: isTablet ? 90 : 60 }}
                contentFit="contain"
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No upcoming HK/Sticky events.</Text>
            </View>
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPad + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom sheet */}
      {sheetVisible && (
        <Modal transparent animationType="none" onRequestClose={closeSheet}>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Scrim */}
            <Animated.View style={[styles.scrim, { opacity: scrimOp }]} pointerEvents="auto">
              <TouchableWithoutFeedback onPress={closeSheet}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
            </Animated.View>

            {/* Sheet */}
            <Animated.View
              style={[styles.sheetWrap, { bottom: bottomPad + 10, transform: [{ translateY: sheetY }] }]}
              pointerEvents="auto"
            >
              <View style={styles.sheetCard}>
                <View style={styles.sheetHead}>
                  <Text style={styles.sheetTitle} numberOfLines={4}>
                    {sheet?.title || "(No title)"}
                  </Text>
                  <Text style={styles.sheetTime}>{sheet?.timeStr}</Text>
                </View>
                <View style={styles.sheetBtns}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.sheetBtn, styles.sheetBtnBlue]}
                    onPress={() => {
                      closeSheet();
                      // Reschedule handled via platform alert + calendar API in full build
                    }}
                  >
                    <Text style={[styles.sheetBtnText, { color: "#9ad0ff" }]}>Reschedule</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.sheetBtn, styles.sheetBtnRed]}
                    onPress={handleDelete}
                  >
                    <Text style={[styles.sheetBtnText, { color: "#ff453a" }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity activeOpacity={0.85} style={styles.cancelBtn} onPress={closeSheet}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
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
  return (
    <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  hamburgerBtn: {
    position: "absolute", left: 16, zIndex: 10,
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },

  listContent: { paddingHorizontal: 14 },

  dayGroup:      { marginTop: 28, width: "100%", maxWidth: 720 },
  dayGroupToday: {
    marginTop: 28,
    paddingTop: 14,
    paddingHorizontal: 6,
    borderRadius: 18,
    // iOS shadow for glow
    shadowColor: T.red, shadowOffset: { width: 0, height: 0 },
    shadowRadius: 28, shadowOpacity: 0.32,
    borderWidth: 1, borderColor: "rgba(255,45,45,0.12)",
  },
  dayHeader: {
    textAlign: "center", fontSize: 20, fontWeight: "900",
    color: T.red, letterSpacing: -0.2,
    fontFamily: "Inter_700Bold", marginBottom: 16,
  },

  eventCard: {
    flexDirection: "row", gap: 12,
    padding: 12, paddingHorizontal: 14,
    marginBottom: 12, borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1, borderColor: T.stroke,
    width: "100%", maxWidth: 720,
  },
  eventCardToday: { borderColor: "rgba(255,45,45,0.14)" },
  eventTime: {
    minWidth: 94, fontSize: 13, fontWeight: "900",
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_700Bold",
  },
  eventTitle: {
    flex: 1, fontSize: 15, fontWeight: "900",
    color: T.text, fontFamily: "Inter_700Bold",
  },

  centerWrap:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  errorText:   { color: T.muted, fontSize: 14, textAlign: "center", fontFamily: "Inter_400Regular", lineHeight: 20 },
  retryBtn:    { backgroundColor: T.red, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 },
  retryText:   { color: "#fff", fontWeight: "800", fontFamily: "Inter_700Bold" },

  emptyWrap:   { alignItems: "center", marginTop: 32 },
  emptyText:   { color: T.muted, fontSize: 15, fontWeight: "800", fontFamily: "Inter_700Bold" },

  spinner: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 7,
    borderColor: "rgba(255,30,30,0.16)",
    borderTopColor: "rgba(255,30,30,0.95)",
    shadowColor: T.red, shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22, shadowOpacity: 0.35,
  },

  // Sheet
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheetWrap: { position: "absolute", left: 12, right: 12 },
  sheetCard: {
    borderRadius: 22, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 18 },
    shadowRadius: 60, shadowOpacity: 0.65,
  },
  sheetHead: {
    padding: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 15, fontWeight: "600", color: "#fff",
    lineHeight: 22, textAlign: "center", fontFamily: "Inter_400Regular",
  },
  sheetTime: {
    marginTop: 4, fontSize: 12, color: T.muted,
    fontFamily: "Inter_400Regular",
  },
  sheetBtns: {
    flexDirection: "row", gap: 10, padding: 16,
  },
  sheetBtn: {
    flex: 1, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  sheetBtnBlue: {
    backgroundColor: "rgba(154,208,255,0.15)",
    borderWidth: 1, borderColor: "rgba(154,208,255,0.35)",
  },
  sheetBtnRed: {
    backgroundColor: "rgba(255,60,60,0.18)",
    borderWidth: 1, borderColor: "rgba(255,60,60,0.35)",
  },
  sheetBtnText: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  cancelBtn: {
    marginTop: 10, borderRadius: 18,
    backgroundColor: "#1c1c1e",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 16, alignItems: "center",
  },
  cancelBtnText: { color: "#fff", fontWeight: "900", fontSize: 17, fontFamily: "Inter_700Bold" },
});
