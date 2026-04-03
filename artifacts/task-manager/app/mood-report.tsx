import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

// ── Constants ────────────────────────────────────────────────────────────────
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

// ── Types ────────────────────────────────────────────────────────────────────
interface MonthData {
  key: string;
  counts: Record<string, number>;
}
type TabType = "pie" | "bar";

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── Pie Chart ────────────────────────────────────────────────────────────────
function PieChart({ slices, total }: { slices: [string, number][]; total: number }) {
  const cx = 90, cy = 90, r = 80, innerR = 38;

  const paths: {
    d: string; color: string;
    lx: number; ly: number; count: number; showLabel: boolean;
  }[] = [];

  let angle = -Math.PI / 2;
  for (const [mood, count] of slices) {
    const sweep = (count / total) * 2 * Math.PI;
    const end = angle + sweep;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = sweep > Math.PI ? 1 : 0;
    const color = MOOD_COLORS[mood] || DEFAULT_COLOR;
    const midAngle = angle + sweep / 2;
    const labelR = (r + innerR) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle) + 5;
    const d = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    paths.push({ d, color, lx, ly, count, showLabel: sweep > 0.25 });
    angle = end;
  }

  return (
    <Svg width={180} height={180} viewBox="0 0 180 180">
      {paths.map((p, i) => (
        <G key={i}>
          <Path d={p.d} fill={p.color} stroke="#1a1a1a" strokeWidth={2} />
          {p.showLabel && (
            <SvgText
              x={p.lx.toFixed(2)}
              y={p.ly.toFixed(1)}
              textAnchor="middle"
              fill="#fff"
              fontSize={14}
              fontWeight="900"
            >
              {p.count}
            </SvgText>
          )}
        </G>
      ))}
      <Circle cx={cx} cy={cy} r={innerR} fill="#1a1a1a" />
      <SvgText
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        fill="#fff"
        fontSize={18}
        fontWeight="bold"
      >
        {total}
      </SvgText>
    </Svg>
  );
}

// ── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({
  presentMoods,
  counts,
  maxVal,
}: {
  presentMoods: string[];
  counts: Record<string, number>;
  maxVal: number;
}) {
  const chartH = 140, barW = 44, barGap = 14;
  const paddingBottom = 48, paddingTop = 28, paddingLeft = 24, paddingRight = 24;
  const totalW = paddingLeft + presentMoods.length * (barW + barGap) - barGap + paddingRight;
  const svgH = chartH + paddingBottom + paddingTop;

  return (
    <Svg width={totalW} height={svgH} viewBox={`0 0 ${totalW} ${svgH}`}>
      {presentMoods.map((mood, i) => {
        const count = counts[mood];
        const barH = Math.max(4, (count / maxVal) * chartH);
        const x = paddingLeft + i * (barW + barGap);
        const y = paddingTop + (chartH - barH);
        const color = MOOD_COLORS[mood] || DEFAULT_COLOR;
        return (
          <G key={mood}>
            <Rect x={x} y={y} width={barW} height={barH} fill={color} rx={6} ry={6} />
            <SvgText
              x={x + barW / 2}
              y={y - 7}
              textAnchor="middle"
              fill="#fff"
              fontSize={13}
              fontWeight="800"
            >
              {count}
            </SvgText>
            <SvgText
              x={x + barW / 2}
              y={paddingTop + chartH + 18}
              textAnchor="middle"
              fill={color}
              fontSize={11}
              fontWeight="700"
            >
              {mood}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────
function SideLegend({ slices, total }: { slices: [string, number][]; total: number }) {
  return (
    <View style={styles.sideLegend}>
      {slices.map(([mood, count]) => {
        const color = MOOD_COLORS[mood] || DEFAULT_COLOR;
        const pct = ((count / total) * 100).toFixed(1);
        return (
          <View key={mood} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendName}>{mood}</Text>
            <Text style={[styles.legendPct, { color }]}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function BottomLegend({ slices, total }: { slices: [string, number][]; total: number }) {
  return (
    <View style={styles.bottomLegend}>
      {slices.map(([mood, count]) => {
        const color = MOOD_COLORS[mood] || DEFAULT_COLOR;
        const pct = ((count / total) * 100).toFixed(1);
        return (
          <View key={mood} style={styles.legendRowBottom}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendNameBottom}>{mood}</Text>
            <Text style={[styles.legendPct, { color }]}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Month Card ───────────────────────────────────────────────────────────────
function MonthCard({ month, tab }: { month: MonthData; tab: TabType }) {
  const slices = getSlices(month.counts);
  const total = slices.reduce((a, [, c]) => a + c, 0);
  if (!slices.length) return null;

  if (tab === "pie") {
    return (
      <View style={styles.monthCard}>
        <Text style={styles.monthTitle}>{monthLabel(month.key)}</Text>
        <View style={styles.pieRow}>
          <PieChart slices={slices} total={total} />
          <SideLegend slices={slices} total={total} />
        </View>
      </View>
    );
  }

  const presentMoods = MOOD_ORDER.filter((m) => month.counts[m]);
  const maxVal = Math.max(...presentMoods.map((m) => month.counts[m]));

  return (
    <View style={styles.monthCard}>
      <Text style={styles.monthTitle}>{monthLabel(month.key)}</Text>
      <View style={styles.barChartCentered}>
        <BarChart presentMoods={presentMoods} counts={month.counts} maxVal={maxVal} />
      </View>
      <BottomLegend slices={slices} total={total} />
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function MoodReportScreen() {
  const { apiKey } = useNotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [months, setMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>("pie");
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
        try {
          data = JSON.parse(text);
        } catch {
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
    <View style={[styles.screen, { paddingTop: topPad }]}>
      <ScreenHeader title="Mood Log" />

      {/* Content */}
      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading mood data…</Text>
        </View>
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
          <Feather name="alert-circle" size={32} color="#F44336" />
          <Text style={[styles.emptyText, { color: "#F44336" }]}>{error}</Text>
        </View>
      ) : months.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyText}>No mood entries found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 8, paddingBottom: tabBarH + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Month cards */}
          <View style={[styles.grid, isTablet && styles.gridTablet]}>
            {months.map((m) => (
              <View key={m.key} style={isTablet ? styles.gridItem : undefined}>
                <MonthCard month={m} tab={tab} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Tab bar */}
      {!loading && !error && months.length > 0 && (
        <View
          style={[styles.tabBar, { paddingBottom: bottomPad }]}
          onLayout={(e) => setTabBarH(e.nativeEvent.layout.height)}
        >
          <Pressable
            style={[styles.tab, tab === "pie" && styles.tabActive]}
            onPress={() => setTab("pie")}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
              stroke={tab === "pie" ? "#fff" : "#555"} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
            >
              <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <Path d="M22 12A10 10 0 0 0 12 2v10z" />
            </Svg>
            <Text style={[styles.tabLabel, tab === "pie" && styles.tabLabelActive]}>
              Pie Chart
            </Text>
          </Pressable>

          <View style={styles.tabDivider} />

          <Pressable
            style={[styles.tab, tab === "bar" && styles.tabActive]}
            onPress={() => setTab("bar")}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
              stroke={tab === "bar" ? "#fff" : "#555"} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
            >
              <Rect x={3} y={12} width={4} height={9} rx={1} />
              <Rect x={10} y={7} width={4} height={14} rx={1} />
              <Rect x={17} y={3} width={4} height={18} rx={1} />
            </Svg>
            <Text style={[styles.tabLabel, tab === "bar" && styles.tabLabelActive]}>
              Bar Chart
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#121212",
  },
  hamburger: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyText: {
    color: "#888",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  settingsBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  settingsBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  headerEmoji: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  grid: {
    gap: 12,
  },
  gridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    width: "48%",
  },
  monthCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 14,
    fontFamily: "Inter_700Bold",
  },
  pieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  barChartCentered: {
    alignItems: "center",
  },
  sideLegend: {
    flex: 1,
    minWidth: 0,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  legendPct: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  bottomLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  legendRowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingRight: 12,
    paddingBottom: 4,
  },
  legendNameBottom: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tabActive: {},
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555",
    fontFamily: "Inter_600SemiBold",
  },
  tabLabelActive: {
    color: "#fff",
  },
  tabDivider: {
    width: 1,
    backgroundColor: "#2a2a2a",
    marginVertical: 14,
  },
});
