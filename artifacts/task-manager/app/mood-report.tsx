import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import Svg, {
  Circle,
  G,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const MOOD_DB_ID = "2dfb7eba3523805bb4b1ffbe52682e4c";

const MOOD_COLORS: Record<string, string> = {
  Awesome:  "#4CAF50",
  Good:     "#8BC34A",
  Meh:      "#FFC107",
  Tired:    "#FF9800",
  Low:      "#F44336",
  Stressed: "#E91E63",
};
const DEFAULT_COLOR = "#607D8B";
const MOOD_ORDER = ["Awesome", "Good", "Meh", "Tired", "Low", "Stressed"];

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

// ── Design tokens (matching Whoop Age / March Sleep) ──────────────────────────
const BG      = "#0b0b0c";
const SURFACE = "#111113";
const CARD    = "#141416";
const BORDER  = "#1e1e22";
const RED     = "#E03131";
const MUTED   = "#666";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthData {
  key: string;
  counts: Record<string, number>;
}
type TabType = "pie" | "bar";

// ── Helpers ───────────────────────────────────────────────────────────────────
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
}

function getSlices(counts: Record<string, number>): [string, number][] {
  return MOOD_ORDER.filter((m) => counts[m]).map((m) => [m, counts[m]]);
}

// ── Pie Chart ─────────────────────────────────────────────────────────────────
function PieChart({ slices, total }: { slices: [string, number][]; total: number }) {
  const cx = 90, cy = 90, r = 80, innerR = 38;
  const paths: { d: string; color: string; lx: number; ly: number; count: number; showLabel: boolean }[] = [];

  let angle = -Math.PI / 2;
  for (const [mood, count] of slices) {
    const sweep = (count / total) * 2 * Math.PI;
    const end   = angle + sweep;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
    const large = sweep > Math.PI ? 1 : 0;
    const color = MOOD_COLORS[mood] || DEFAULT_COLOR;
    const midAngle = angle + sweep / 2;
    const labelR = (r + innerR) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle) + 5;
    const d  = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    paths.push({ d, color, lx, ly, count, showLabel: sweep > 0.25 });
    angle = end;
  }

  return (
    <Svg width={180} height={180} viewBox="0 0 180 180">
      {paths.map((p, i) => (
        <G key={i}>
          <Path d={p.d} fill={p.color} stroke={CARD} strokeWidth={2} />
          {p.showLabel && (
            <SvgText x={p.lx.toFixed(2)} y={p.ly.toFixed(1)} textAnchor="middle"
              fill="#fff" fontSize={14} fontWeight="900">{p.count}</SvgText>
          )}
        </G>
      ))}
      <Circle cx={cx} cy={cy} r={innerR} fill={CARD} />
      <SvgText x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize={18} fontWeight="bold">{total}</SvgText>
    </Svg>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ presentMoods, counts, maxVal }: { presentMoods: string[]; counts: Record<string, number>; maxVal: number }) {
  const chartH = 140, barW = 44, barGap = 14;
  const paddingBottom = 48, paddingTop = 28, paddingLeft = 24, paddingRight = 24;
  const totalW = paddingLeft + presentMoods.length * (barW + barGap) - barGap + paddingRight;
  const svgH   = chartH + paddingBottom + paddingTop;

  return (
    <Svg width={totalW} height={svgH} viewBox={`0 0 ${totalW} ${svgH}`}>
      {presentMoods.map((mood, i) => {
        const count = counts[mood];
        const barH  = Math.max(4, (count / maxVal) * chartH);
        const x     = paddingLeft + i * (barW + barGap);
        const y     = paddingTop + (chartH - barH);
        const color = MOOD_COLORS[mood] || DEFAULT_COLOR;
        return (
          <G key={mood}>
            <Rect x={x} y={y} width={barW} height={barH} fill={color} rx={5} ry={5} />
            <SvgText x={x + barW / 2} y={y - 7} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="800">{count}</SvgText>
            <SvgText x={x + barW / 2} y={paddingTop + chartH + 18} textAnchor="middle" fill={color} fontSize={10} fontWeight="700">{mood.toUpperCase()}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function SideLegend({ slices, total }: { slices: [string, number][]; total: number }) {
  return (
    <View style={s.sideLegend}>
      {slices.map(([mood, count]) => {
        const color = MOOD_COLORS[mood] || DEFAULT_COLOR;
        const pct   = ((count / total) * 100).toFixed(0);
        return (
          <View key={mood} style={s.legendRow}>
            <View style={{ flex: 1 }} />
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendName}>{mood.toUpperCase()}</Text>
            <Text style={[s.legendPct, { color }]}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function BottomLegend({ slices, total }: { slices: [string, number][]; total: number }) {
  return (
    <View style={s.bottomLegend}>
      {slices.map(([mood, count]) => {
        const color = MOOD_COLORS[mood] || DEFAULT_COLOR;
        const pct   = ((count / total) * 100).toFixed(0);
        return (
          <View key={mood} style={s.legendRowBottom}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendNameBottom}>{mood.toUpperCase()}</Text>
            <Text style={[s.legendPct, { color }]}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Month Card ────────────────────────────────────────────────────────────────
function MonthCard({ month, tab }: { month: MonthData; tab: TabType }) {
  const slices = getSlices(month.counts);
  const total  = slices.reduce((a, [, c]) => a + c, 0);
  if (!slices.length) return null;

  const label = monthLabel(month.key).toUpperCase();

  if (tab === "pie") {
    return (
      <View style={s.monthCard}>
        <View style={s.cardHeader}>
          <Text style={s.cardMonth}>{label}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.pieRow}>
          <PieChart slices={slices} total={total} />
          <SideLegend slices={slices} total={total} />
        </View>
      </View>
    );
  }

  const presentMoods = MOOD_ORDER.filter((m) => month.counts[m]);
  const maxVal       = Math.max(...presentMoods.map((m) => month.counts[m]));

  return (
    <View style={s.monthCard}>
      <View style={s.cardHeader}>
        <Text style={s.cardMonth}>{label}</Text>
      </View>
      <View style={s.divider} />
      <View style={s.barChartCentered}>
        <BarChart presentMoods={presentMoods} counts={month.counts} maxVal={maxVal} />
      </View>
      <BottomLegend slices={slices} total={total} />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MoodReportScreen() {
  const { apiKey } = useNotion();
  const insets     = useSafeAreaInsets();
  const { width }  = useWindowDimensions();
  const isTablet   = width >= 768;

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [months,  setMonths]  = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<TabType>("bar");
  const [tabBarH, setTabBarH] = useState(0);

  useEffect(() => {
    if (!apiKey) { setLoading(false); return; }
    let cancelled = false;

    const tryFetch = async (attemptsLeft: number) => {
      try {
        const r = await fetch(
          `${BASE_URL}/api/notion/moods?database_id=${MOOD_DB_ID}`,
          { headers: { "x-notion-key": apiKey } }
        );
        const text = await r.text();
        let data: any;
        try { data = JSON.parse(text); }
        catch {
          if (attemptsLeft > 1 && !cancelled) {
            await new Promise((res) => setTimeout(res, 2000));
            if (!cancelled) tryFetch(attemptsLeft - 1);
          } else if (!cancelled) {
            setError("Server is starting up — pull down to retry");
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        if (data.message) throw new Error(data.message);
        setMonths(data.months || []);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    };

    tryFetch(3);
    return () => { cancelled = true; };
  }, [apiKey]);

  return (
    <View style={[s.screen, { paddingTop: topPad }]}>
      <ScreenHeader title="Mood Log" />

      {loading ? (
        <PageLoader />
      ) : !apiKey ? (
        <View style={s.centred}>
          <Feather name="alert-circle" size={32} color={MUTED} />
          <Text style={s.emptyText}>Add your Notion API key in Settings</Text>
          <Pressable style={s.settingsBtn} onPress={() => router.push("/settings" as any)}>
            <Text style={s.settingsBtnText}>Open Settings</Text>
          </Pressable>
        </View>
      ) : error ? (
        <View style={s.centred}>
          <Feather name="alert-circle" size={32} color={RED} />
          <Text style={[s.emptyText, { color: RED }]}>{error}</Text>
        </View>
      ) : months.length === 0 ? (
        <View style={s.centred}>
          <Text style={s.emptyText}>No mood entries found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: tabBarH + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={s.reportHeader}>
            <Text style={s.reportEmoji}>😊</Text>
            <Text style={s.reportTitle}>MOOD <Text style={s.reportTitleAccent}>LOG</Text></Text>
            <Text style={s.reportSubtitle}>· mood tracking by month ·</Text>
            <View style={s.accentLine} />
          </View>

          {/* ── Month cards ── */}
          <View style={[s.grid, isTablet && s.gridTablet]}>
            {months.map((m) => (
              <View key={m.key} style={isTablet ? s.gridItem : undefined}>
                <MonthCard month={m} tab={tab} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Tab bar ── */}
      {!loading && !error && months.length > 0 && (
        <View
          style={[s.tabBar, { paddingBottom: bottomPad }]}
          onLayout={(e) => setTabBarH(e.nativeEvent.layout.height)}
        >
          <Pressable style={s.tab} onPress={() => setTab("bar")}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
              stroke={tab === "bar" ? "#fff" : MUTED} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
            >
              <Rect x={3} y={12} width={4} height={9} rx={1} />
              <Rect x={10} y={7} width={4} height={14} rx={1} />
              <Rect x={17} y={3} width={4} height={18} rx={1} />
            </Svg>
            <Text style={[s.tabLabel, tab === "bar" && s.tabLabelActive]}>BAR</Text>
            <View style={[s.tabIndicator, tab === "bar" && s.tabIndicatorActive]} />
          </Pressable>

          <View style={s.tabDivider} />

          <Pressable style={s.tab} onPress={() => setTab("pie")}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
              stroke={tab === "pie" ? "#fff" : MUTED} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
            >
              <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <Path d="M22 12A10 10 0 0 0 12 2v10z" />
            </Svg>
            <Text style={[s.tabLabel, tab === "pie" && s.tabLabelActive]}>PIE</Text>
            <View style={[s.tabIndicator, tab === "pie" && s.tabIndicatorActive]} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  centred: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 12, paddingHorizontal: 32,
  },
  emptyText: {
    color: MUTED, fontSize: 15,
    fontFamily: "Inter_400Regular", textAlign: "center",
  },
  settingsBtn: {
    marginTop: 8, paddingVertical: 10, paddingHorizontal: 24,
    backgroundColor: SURFACE, borderRadius: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  settingsBtnText: {
    color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold",
  },

  // ── Scroll ──
  scrollContent: { paddingHorizontal: 14, paddingTop: 6 },

  // ── Report header ──
  reportHeader: { alignItems: "center", marginBottom: 20, paddingTop: 8 },
  reportEmoji:  { fontSize: 30, marginBottom: 6 },
  reportTitle:  {
    fontSize: 26, fontFamily: "Inter_700Bold",
    color: "#fff", letterSpacing: 3, textTransform: "uppercase",
  },
  reportTitleAccent: { color: RED },
  reportSubtitle: {
    fontSize: 10, color: MUTED,
    letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Inter_500Medium", marginTop: 5,
  },
  accentLine: {
    width: 32, height: 2, backgroundColor: RED,
    borderRadius: 1, marginTop: 10,
  },

  // ── Grid ──
  grid:       { gap: 10 },
  gridTablet: { flexDirection: "row", flexWrap: "wrap" },
  gridItem:   { width: "48%" },

  // ── Month card ──
  monthCard: {
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardHeader: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: SURFACE,
  },
  cardMonth: {
    fontSize: 13, fontFamily: "Inter_700Bold",
    color: "#fff", letterSpacing: 2, textTransform: "uppercase",
    fontWeight: "800",
  },
  cardTotal: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: RED,
  },
  cardTotalUnit: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: MUTED,
  },
  divider: { height: 1, backgroundColor: BORDER },

  pieRow: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 14,
  },
  barChartCentered: { alignItems: "center", paddingTop: 10 },

  // ── Legend ──
  sideLegend: { flex: 1, minWidth: 0 },
  legendRow: {
    flexDirection: "row", alignItems: "center",
    gap: 6, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendName: {
    color: "#fff",
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1, textTransform: "uppercase",
  },
  legendPct: {
    fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "right",
  },
  bottomLegend: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: BORDER, gap: 8,
  },
  legendRowBottom: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  legendNameBottom: {
    color: "#aaa", fontSize: 9, fontFamily: "Inter_600SemiBold",
    letterSpacing: 1, textTransform: "uppercase",
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0f0f0f",
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  tab: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 4, paddingTop: 10, paddingBottom: 6,
  },
  tabLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: MUTED, letterSpacing: 2,
  },
  tabLabelActive: { color: "#fff" },
  tabIndicator: {
    width: 20, height: 2, borderRadius: 1, backgroundColor: "transparent",
  },
  tabIndicatorActive: { backgroundColor: RED },
  tabDivider: {
    width: 1, backgroundColor: BORDER, marginVertical: 12,
  },
});
