import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKLOAD_DB_ID = "2c8b7eba3523802abbe2e934df42a4e2";
const HK_RED   = "#ff1e1e";
const DONE_CLR = "#4CAF50";
const MUTED    = "rgba(255,255,255,0.45)";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WeekData {
  created: number;
  done: number;
  createdItems: string[];
  doneItems: string[];
}
interface CategoryData {
  name: string;
  created: number;
  done: number;
  doneItems: string[];
}
interface MonthData {
  key: string;
  label: string;
  totalCreated: number;
  totalDone: number;
  maxWeekVal: number;
  maxCatVal: number;
  visibleWeeks: string[];
  weeks: Record<string, WeekData>;
  categories: CategoryData[];
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function WorkloadBarChart({
  weeks,
  visibleWeeks,
  maxVal,
  availableWidth,
}: {
  weeks: Record<string, WeekData>;
  visibleWeeks: string[];
  maxVal: number;
  availableWidth?: number;
}) {
  const chartH = 180, barW = 22, barGap = 6, groupGap = 24;
  const pL = 32, pR = 20, pT = 28, pB = 34;
  const groupW = barW * 2 + barGap;

  // Always lay out at least 4 week columns — pads with empty slots for short months
  const MIN_WEEKS = 4;
  const layoutWeeks = visibleWeeks.length >= MIN_WEEKS
    ? visibleWeeks
    : [...visibleWeeks, ...Array(MIN_WEEKS - visibleWeeks.length).fill("")];

  const totalW = pL + layoutWeeks.length * (groupW + groupGap) - groupGap + pR;
  const svgH = chartH + pT + pB;

  // Scale SVG to fill card width on tablet — capped so bars never exceed 50px wide
  const maxScale  = 50 / barW;                // ~2.27×
  const fillWidth = availableWidth != null && availableWidth > totalW;
  const renderW   = fillWidth ? Math.min(availableWidth!, Math.round(totalW * maxScale)) : totalW;
  const renderH   = fillWidth ? Math.round(svgH * (renderW / totalW)) : svgH;

  const gridLines = [0, 1, 2, 3, 4].map((i) => {
    const y = pT + (chartH / 4) * i;
    const val = Math.round(maxVal - (maxVal / 4) * i);
    return { y, val };
  });

  const svgEl = (
    <Svg width={renderW} height={renderH} viewBox={`0 0 ${totalW} ${svgH}`}>
        {gridLines.map(({ y, val }) => (
          <G key={y}>
            <Line
              x1={pL} y1={y} x2={totalW - pR} y2={y}
              stroke="rgba(255,30,30,0.07)" strokeWidth={1}
            />
            <SvgText
              x={pL - 5} y={y + 4}
              textAnchor="end" fill="rgba(255,255,255,0.25)"
              fontSize={9}
            >
              {val}
            </SvgText>
          </G>
        ))}

        {layoutWeeks.map((week, i) => {
          const wd = week ? (weeks[week] || { created: 0, done: 0 }) : { created: 0, done: 0 };
          const gx = pL + i * (groupW + groupGap);

          const ch = maxVal > 0
            ? Math.max(wd.created > 0 ? 3 : 0, (wd.created / maxVal) * chartH)
            : 0;
          const cx = gx;
          const cy = pT + chartH - ch;

          const dh = maxVal > 0
            ? Math.max(wd.done > 0 ? 3 : 0, (wd.done / maxVal) * chartH)
            : 0;
          const dx = gx + barW + barGap;
          const dy = pT + chartH - dh;

          return (
            <G key={week || `empty-${i}`}>
              {week && wd.created > 0 && (
                <G>
                  <Rect x={cx} y={cy} width={barW} height={ch} fill={HK_RED} rx={5} ry={5} />
                  <SvgText x={cx + barW / 2} y={cy - 6} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="800">
                    {wd.created}
                  </SvgText>
                </G>
              )}
              {week && wd.done > 0 && (
                <G>
                  <Rect x={dx} y={dy} width={barW} height={dh} fill={DONE_CLR} rx={5} ry={5} />
                  <SvgText x={dx + barW / 2} y={dy - 6} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="800">
                    {wd.done}
                  </SvgText>
                </G>
              )}
              <SvgText
                x={gx + groupW / 2} y={pT + chartH + 22}
                textAnchor="middle"
                fill={week ? MUTED : "rgba(255,255,255,0.1)"}
                fontSize={11} fontWeight="700"
              >
                {week || "—"}
              </SvgText>
            </G>
          );
        })}
      </Svg>
  );

  return (
    <View style={{ height: renderH }}>
      {fillWidth ? svgEl : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {svgEl}
        </ScrollView>
      )}
    </View>
  );
}

// ── Week Row ──────────────────────────────────────────────────────────────────
function WeekRow({
  week,
  data,
  maxVal,
}: {
  week: string;
  data: WeekData;
  maxVal: number;
}) {
  const [open, setOpen] = useState(false);
  const hasItems = data.createdItems.length > 0 || data.doneItems.length > 0;
  const cp = maxVal > 0 ? (data.created / maxVal) * 100 : 0;
  const dp = maxVal > 0 ? (data.done / maxVal) * 100 : 0;

  return (
    <View style={styles.weekRow}>
      <Pressable
        style={styles.weekHead}
        onPress={hasItems ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen((v) => !v); } : undefined}
        disabled={!hasItems}
      >
        <Text style={styles.weekName}>{week}</Text>
        <View style={styles.weekRight}>
          <View style={styles.weekBadges}>
            <View style={styles.createdBadge}><Text style={styles.createdBadgeText}>{data.created}</Text></View>
            <View style={styles.doneBadge}><Text style={styles.doneBadgeText}>{data.done}</Text></View>
          </View>
          {hasItems && (
            <Text style={[styles.weekChevron, open && styles.weekChevronOpen]}>▶</Text>
          )}
        </View>
      </Pressable>

      <View style={styles.weekBars}>
        <View style={styles.barLine}>
          <Text style={styles.barLabel}>Created</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFg, { width: `${cp}%`, backgroundColor: HK_RED }]} />
          </View>
        </View>
        <View style={styles.barLine}>
          <Text style={styles.barLabel}>Done</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFg, { width: `${dp}%`, backgroundColor: DONE_CLR }]} />
          </View>
        </View>
      </View>

      {open && (
        <View style={styles.expandArea}>
          {data.createdItems.length > 0 && (
            <View>
              <Text style={[styles.expandSectionLabel, { color: HK_RED }]}>Created</Text>
              {data.createdItems.map((t, i) => (
                <View key={i} style={styles.expandItem}>
                  <View style={[styles.expandDot, { backgroundColor: HK_RED }]} />
                  <Text style={styles.expandText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {data.doneItems.length > 0 && (
            <View style={data.createdItems.length > 0 ? { marginTop: 8 } : undefined}>
              <Text style={[styles.expandSectionLabel, { color: DONE_CLR }]}>Completed</Text>
              {data.doneItems.map((t, i) => (
                <View key={i} style={styles.expandItem}>
                  <View style={[styles.expandDot, { backgroundColor: DONE_CLR }]} />
                  <Text style={styles.expandText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Category Row ──────────────────────────────────────────────────────────────
function CategoryRow({ cat, maxVal }: { cat: CategoryData; maxVal: number }) {
  const cp = Math.min(100, maxVal > 0 ? (cat.created / maxVal) * 100 : 0);
  const dp = Math.min(100, maxVal > 0 ? (cat.done / maxVal) * 100 : 0);
  return (
    <View style={styles.catRow}>
      <Text style={styles.catName}>{cat.name.trim()}</Text>
      <View style={styles.catBars}>
        <View style={styles.catBarLine}>
          <Text style={styles.barLabel}>Created</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFg, { width: `${cp}%`, backgroundColor: HK_RED }]} />
          </View>
          <Text style={[styles.catVal, { color: HK_RED }]}>{cat.created}</Text>
        </View>
        <View style={styles.catBarLine}>
          <Text style={styles.barLabel}>Done</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFg, { width: `${dp}%`, backgroundColor: DONE_CLR }]} />
          </View>
          <Text style={[styles.catVal, { color: DONE_CLR }]}>{cat.done}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Month View ────────────────────────────────────────────────────────────────
function MonthView({ month }: { month: MonthData }) {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 768;
  const [chartCardW, setChartCardW] = useState(0);

  const ratio = month.totalCreated > 0
    ? Math.round((month.totalDone / month.totalCreated) * 100)
    : 0;
  const ratioColor = ratio >= 80 ? DONE_CLR : ratio >= 50 ? "#FFC107" : HK_RED;

  const barChartCard = month.visibleWeeks.length > 0 ? (
    <View
      style={[styles.card, isTablet && { flex: 1 }]}
      onLayout={(e) => { if (isTablet) setChartCardW(e.nativeEvent.layout.width - 24); }}
    >
      <View style={isTablet ? { flex: 1, justifyContent: "flex-end" } : undefined}>
        <WorkloadBarChart
          weeks={month.weeks}
          visibleWeeks={month.visibleWeeks}
          maxVal={month.maxWeekVal}
          availableWidth={isTablet && chartCardW > 0 ? chartCardW : undefined}
        />
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: HK_RED }]} />
            <Text style={styles.legendText}>Created</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DONE_CLR }]} />
            <Text style={styles.legendText}>Done</Text>
          </View>
        </View>
      </View>
    </View>
  ) : (
    <View style={[styles.card, styles.emptyCard]}>
      <Text style={styles.emptyCardText}>No data yet for this month</Text>
    </View>
  );

  const weeklyCard = (
    <View style={[styles.card, isTablet && { flex: 1 }]}>
      <View style={styles.cardSectionHeader}>
        <Text style={styles.cardSectionTitle}>Weekly Breakdown</Text>
      </View>
      <View style={styles.cardSectionDivider} />
      <View style={styles.cardSectionContent}>
        {month.visibleWeeks.length > 0
          ? month.visibleWeeks.map((w) => (
              <WeekRow key={w} week={w} data={month.weeks[w] || { created: 0, done: 0, createdItems: [], doneItems: [] }} maxVal={month.maxWeekVal} />
            ))
          : <Text style={styles.emptyCardText}>No weeks yet</Text>
        }
      </View>
    </View>
  );

  const categoryCard = (
    <View style={[styles.card, { marginBottom: 24 }]}>
      <View style={styles.cardSectionHeader}>
        <Text style={styles.cardSectionTitle}>Category Breakdown</Text>
      </View>
      <View style={styles.cardSectionDivider} />
      <View style={styles.cardSectionContent}>
        {month.categories.length > 0
          ? month.categories.map((cat) => (
              <CategoryRow key={cat.name} cat={cat} maxVal={month.maxCatVal} />
            ))
          : <Text style={styles.emptyCardText}>No category data</Text>
        }
      </View>
    </View>
  );

  return (
    <View>
      {/* Summary pills */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <View style={[styles.summaryDot, { backgroundColor: HK_RED }]} />
          <Text style={styles.summaryLabel}>Created</Text>
          <Text style={[styles.summaryVal, { color: HK_RED }]}>{month.totalCreated}</Text>
        </View>
        <View style={styles.summaryPill}>
          <View style={[styles.summaryDot, { backgroundColor: DONE_CLR }]} />
          <Text style={styles.summaryLabel}>Done</Text>
          <Text style={[styles.summaryVal, { color: DONE_CLR }]}>{month.totalDone}</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryLabel}>Completion</Text>
          <Text style={[styles.summaryVal, { color: ratioColor }]}>{ratio}%</Text>
        </View>
      </View>

      {isTablet ? (
        <>
          {/* iPad: bar chart left, weekly breakdown right */}
          <View style={styles.tabletTopRow}>
            <View style={styles.tabletLeft}>{barChartCard}</View>
            <View style={styles.tabletRight}>{weeklyCard}</View>
          </View>
          {/* iPad: category breakdown full width */}
          {categoryCard}
        </>
      ) : (
        <>
          {barChartCard}
          {weeklyCard}
          {categoryCard}
        </>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MyWorkloadScreen() {
  const { apiKey } = useNotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [months, setMonths] = useState<MonthData[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) { setLoading(false); return; }
    let cancelled = false;

    const tryFetch = async (attemptsLeft: number) => {
      try {
        const r = await fetch(
          `${BASE_URL}/api/notion/workload?database_id=${WORKLOAD_DB_ID}`,
          { headers: { "x-notion-key": apiKey } }
        );
        const text = await r.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          if (attemptsLeft > 1 && !cancelled) {
            await new Promise((res) => setTimeout(res, 2000));
            if (!cancelled) tryFetch(attemptsLeft - 1);
          } else if (!cancelled) {
            setError("Server is starting up — reload to retry");
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        if (data.message) throw new Error(data.message);
        const ms: MonthData[] = data.months || [];
        setMonths(ms);
        if (ms.length > 0) setSelectedKey(ms[ms.length - 1].key);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    };

    tryFetch(3);
    return () => { cancelled = true; };
  }, [apiKey]);

  const selectedMonth = months.find((m) => m.key === selectedKey) || null;

  return (
    <View style={[styles.screen, { paddingTop: topPad }]}>
      <ScreenHeader title="My Workload" />

      {loading ? (
        <PageLoader />
      ) : !apiKey ? (
        <View style={styles.centred}>
          <Feather name="alert-circle" size={32} color="#607D8B" />
          <Text style={styles.emptyText}>Add your Notion API key in Settings</Text>
          <Pressable style={styles.settingsBtn} onPress={() => router.push("/settings" as any)}>
            <Text style={styles.settingsBtnText}>Open Settings</Text>
          </Pressable>
        </View>
      ) : error ? (
        <View style={styles.centred}>
          <Feather name="alert-circle" size={32} color={HK_RED} />
          <Text style={[styles.emptyText, { color: HK_RED }]}>{error}</Text>
        </View>
      ) : months.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyText}>No data found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 8, paddingBottom: bottomPad + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Month pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsScroller}
            style={{ marginBottom: 16 }}
          >
            {months.map((m) => (
              <Pressable
                key={m.key}
                style={[styles.pill, m.key === selectedKey && styles.pillActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedKey(m.key);
                }}
              >
                <Text style={[styles.pillText, m.key === selectedKey && styles.pillTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Selected month content */}
          {selectedMonth && <MonthView month={selectedMonth} />}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  hamburger: { position: "absolute", left: 16, zIndex: 10, padding: 8 },
  centred: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { color: "#555", fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyText: { color: "#555", fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  settingsBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#111", borderRadius: 12, borderWidth: 1, borderColor: "#222" },
  settingsBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scrollContent: { paddingHorizontal: 14 },
  pageTitle: { fontSize: 24, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 16, fontFamily: "Inter_700Bold" },
  pillsScroller: { paddingHorizontal: 2, gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)" },
  pillActive: { backgroundColor: HK_RED, borderColor: HK_RED },
  pillText: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.5)", fontFamily: "Inter_700Bold" },
  pillTextActive: { color: "#fff" },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  summaryPill: { flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
  summaryDot: { width: 7, height: 7, borderRadius: 4 },
  summaryLabel: { color: MUTED, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, fontFamily: "Inter_600SemiBold" },
  summaryVal: { fontSize: 20, fontWeight: "900", lineHeight: 22, fontFamily: "Inter_700Bold" },
  card: { backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 12, marginBottom: 8, overflow: "hidden" },
  emptyCard: { alignItems: "center", paddingVertical: 20 },
  emptyCardText: { color: MUTED, fontSize: 13, fontFamily: "Inter_400Regular" },
  chartLegend: { flexDirection: "row", justifyContent: "center", gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,30,30,0.07)" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { color: MUTED, fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: "#fff", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, marginLeft: 2, fontFamily: "Inter_600SemiBold" },
  cardSectionHeader: { marginHorizontal: -12, marginTop: -12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#111113", alignItems: "center", justifyContent: "center" },
  cardSectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 2, textTransform: "uppercase", fontWeight: "800" },
  cardSectionDivider: { height: 1, backgroundColor: "#1e1e22", marginHorizontal: -12, marginBottom: 10 },
  cardSectionContent: {},
  tabletTopRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  tabletLeft:   { flex: 1 },
  tabletRight:  { flex: 1 },
  weekRow: { backgroundColor: "rgba(255,255,255,0.02)", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10, marginBottom: 8 },
  weekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  weekName: { fontSize: 15, fontWeight: "900", color: "#fff", fontFamily: "Inter_700Bold" },
  weekRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  weekBadges: { flexDirection: "row", gap: 6 },
  createdBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,30,30,0.1)" },
  createdBadgeText: { fontSize: 12, fontWeight: "800", color: HK_RED, fontFamily: "Inter_700Bold" },
  doneBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(76,175,80,0.1)" },
  doneBadgeText: { fontSize: 12, fontWeight: "800", color: DONE_CLR, fontFamily: "Inter_700Bold" },
  weekChevron: { fontSize: 11, color: "rgba(255,255,255,0.35)" },
  weekChevronOpen: { transform: [{ rotate: "90deg" }] },
  weekBars: { gap: 6 },
  barLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { width: 48, fontSize: 10, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.2, fontFamily: "Inter_600SemiBold" },
  barBg: { flex: 1, height: 6, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  barFg: { height: "100%", borderRadius: 4 },
  expandArea: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)", gap: 2 },
  expandSectionLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, fontFamily: "Inter_600SemiBold" },
  expandItem: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 2 },
  expandDot: { width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  expandText: { flex: 1, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 19, fontFamily: "Inter_400Regular" },
  catRow: { paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,30,30,0.05)" },
  catName: { fontSize: 13, fontWeight: "800", color: "#fff", marginBottom: 6, fontFamily: "Inter_700Bold" },
  catBars: { gap: 5 },
  catBarLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  catVal: { width: 24, fontSize: 11, fontWeight: "800", textAlign: "right", fontFamily: "Inter_700Bold" },
});
