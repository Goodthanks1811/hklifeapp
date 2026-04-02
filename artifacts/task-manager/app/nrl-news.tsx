import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useDrawer } from "@/context/DrawerContext";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Config ─────────────────────────────────────────────────────────────────────
const HEADER_IMAGE = "https://i.postimg.cc/8CFL755P/IMG-4791.png";
const BASE_URL     = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

// ── Theme ──────────────────────────────────────────────────────────────────────
const C = {
  bg:        "#000000",
  card:      "#111214",
  cardBorder:"rgba(255,255,255,0.08)",
  green:     "#2DB65F",
  greenRgb:  "45,182,95",
  greenLight:"#5FEB91",
  text:      "#ffffff",
  muted:     "#888888",
  dim:       "rgba(255,255,255,0.5)",
  tabBg:     "#111214",
  tabActiveBg: "rgba(45,182,95,0.12)",
  tabBorder: "rgba(255,255,255,0.06)",
};

// ── Types ──────────────────────────────────────────────────────────────────────
type TabId = "news" | "teamlists";
interface NewsItem   { title: string; link: string; pubDate: string; category: string }
interface ArticleBlock { type: "heading" | "paragraph"; text: string }
interface Article   { title: string; blocks: ArticleBlock[] }

// ── Helpers ────────────────────────────────────────────────────────────────────
function isFirstTake(item: NewsItem): boolean {
  return item.title.toLowerCase().startsWith("first take");
}

function isTeamList(item: NewsItem): boolean {
  const cat = (item.category ?? "").toLowerCase();
  // NRL.com tags team selection articles as "Team Lists" or "Match Preview"
  if (cat.includes("team list") || cat === "match preview") return true;
  // Fallback: URL slug (no category returned) — exclude fantasy columns
  if (!cat) return item.link.includes("team-list") && !isFirstTake(item);
  return false;
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function NrlSpinner() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 1000,
        easing: Easing.bezier(0.6, 0.2, 0.4, 0.8),
        useNativeDriver: true,
      })
    ).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={sp.wrap}>
      <Animated.View style={[sp.ring, { transform: [{ rotate }] }]} />
    </View>
  );
}
const sp = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 5,
    borderColor: "#1a1a1a",
    borderTopColor: C.green,
    borderRightColor: C.green,
  },
});

// ── Tab bar ────────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: "news",      label: "NRL News"   },
  { id: "teamlists", label: "Team Lists" },
];

function TabBar({ active, onChange, isTablet }: { active: TabId; onChange: (t: TabId) => void; isTablet: boolean }) {
  return (
    <View style={[tb.row, { marginTop: isTablet ? 12 : 8, marginBottom: isTablet ? 18 : 14 }]}>
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              if (!isActive) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(tab.id);
              }
            }}
            style={[tb.tab, isActive && tb.tabActive]}
          >
            <Text style={[tb.label, { fontSize: isTablet ? 15 : 13 }, isActive && tb.labelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={tb.underline} />}
          </Pressable>
        );
      })}
    </View>
  );
}
const tb = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: C.tabBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.tabBorder,
    overflow: "hidden",
  },
  tab: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 11,
    position: "relative",
  },
  tabActive: {
    backgroundColor: C.tabActiveBg,
  },
  label: {
    color: C.text,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  labelActive: {
    color: C.green,
  },
  underline: {
    position: "absolute",
    bottom: 0, left: "15%", right: "15%",
    height: 2, borderRadius: 2,
    backgroundColor: C.green,
  },
});

// ── Article card ───────────────────────────────────────────────────────────────
function ArticleCard({ item, onPress, isTablet }: { item: NewsItem; onPress: () => void; isTablet: boolean }) {
  const titleSize = isTablet ? 14 : 13;
  const padV      = isTablet ? 13 : 12;
  const padH      = 16;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ac.shell, pressed && { opacity: 0.8 }]}>
      <View style={[ac.card, { paddingVertical: padV, paddingHorizontal: padH }]}>
        <Text style={[ac.title, { fontSize: titleSize, lineHeight: titleSize * 1.38, fontWeight: "500" }]}>{item.title}</Text>
        <Text style={[ac.chevron, { fontSize: 16, lineHeight: 16 }]}>›</Text>
      </View>
    </Pressable>
  );
}
const ac = StyleSheet.create({
  shell:   { position: "relative", marginBottom: 0 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    zIndex: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32, shadowRadius: 20, elevation: 6,
  },
  title:   { flex: 1, color: C.text, textAlign: "center", letterSpacing: -0.2 },
  chevron: { color: C.muted },
});

// ── Article body ───────────────────────────────────────────────────────────────
function ArticleBody({ blocks, isTablet }: { blocks: ArticleBlock[]; isTablet: boolean }) {
  const textSize    = isTablet ? 16 : 15;
  const headingSize = isTablet ? 19 : 17;
  const divH        = 3;

  return (
    <View style={[ab.body, { borderRadius: isTablet ? 18 : 16, padding: isTablet ? 24 : 18 }]}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const showDivider = i > 0 && blocks[i - 1]?.type !== "heading";
          return (
            <View key={i}>
              {showDivider && (
                <View style={[ab.divider, { height: divH, marginTop: isTablet ? 32 : 26, marginBottom: isTablet ? 16 : 12 }]} />
              )}
              <Text style={[ab.heading, { fontSize: headingSize, marginBottom: 8 }]}>{block.text}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[ab.para, { fontSize: textSize, lineHeight: textSize * 1.62, marginBottom: 14 }]}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}
const ab = StyleSheet.create({
  body: {
    borderWidth: 1, borderColor: C.cardBorder,
    backgroundColor: "#151515",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 28, elevation: 6,
    overflow: "hidden",
  },
  heading: { color: C.text, fontWeight: "800", lineHeight: 32, letterSpacing: -0.3 },
  para:    { color: C.text, letterSpacing: -0.15 },
  divider: {
    borderRadius: 4,
    marginHorizontal: 10,
    backgroundColor: C.green,
    shadowColor: C.green, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 8,
  },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function NrlNewsScreen() {
  const { openDrawer } = useDrawer();
  const insets               = useSafeAreaInsets();
  const { width: screenW }   = useWindowDimensions();
  const isTablet             = screenW >= 768;

  const [news,       setNews]       = useState<NewsItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<TabId>("news");

  const [article,    setArticle]    = useState<Article | null>(null);
  const [artLoading, setArtLoading] = useState(false);
  const [artError,   setArtError]   = useState<string | null>(null);

  // Transition anim: 0 = list, 1 = article
  const viewAnim  = useRef(new Animated.Value(0)).current;
  const articleRef = useRef<Article | null>(null);

  const topPad  = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const sidePad = isTablet ? 20 : 14;
  const maxW    = isTablet ? 1000 : 760;

  // ── Filtered list ─────────────────────────────────────────────────────────
  const visibleNews = activeTab === "teamlists"
    ? news.filter(isTeamList)
    : news.filter(x => !isFirstTake(x) && !isTeamList(x));

  // ── Fetch news list ──────────────────────────────────────────────────────────
  const fetchNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE_URL}/api/nrl/news`, { cache: "no-store" });
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const data = await r.json();
      setNews(data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load news");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, []);

  // ── Open article ─────────────────────────────────────────────────────────────
  const openArticle = useCallback(async (item: NewsItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setArtError(null);
    setArtLoading(true);
    setArticle(null);

    Animated.timing(viewAnim, {
      toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    try {
      const r = await fetch(`${BASE_URL}/api/nrl/article?url=${encodeURIComponent(item.link)}`);
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const data: Article = await r.json();
      setArticle(data);
      articleRef.current = data;
    } catch (e: any) {
      setArtError(e?.message ?? "Failed to load article");
    } finally {
      setArtLoading(false);
    }
  }, [viewAnim]);

  // ── Go back ──────────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(viewAnim, {
      toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      setArticle(null);
      setArtLoading(false);
      setArtError(null);
    });
  }, [viewAnim]);

  const listTranslateX    = viewAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -screenW] });
  const articleTranslateX = viewAnim.interpolate({ inputRange: [0, 1], outputRange: [screenW, 0] });

  const headerImgW = isTablet ? screenW * 0.22 : screenW * 0.46;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* ── LIST VIEW ────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.pane, { transform: [{ translateX: listTranslateX }] }]}>
        {/* Hamburger */}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openDrawer(); }}
          style={[styles.hamburger, { top: topPad + 4 }]}
          hitSlop={16}
        >
          <Feather name="menu" size={isTablet ? 22 : 20} color="rgba(255,255,255,0.7)" />
        </Pressable>

        {/* Full-screen centred loader */}
        {loading && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <NrlSpinner />
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 0 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNews(true)}
              tintColor={C.green}
              colors={[C.green]}
            />
          }
        >
          {/* Header image */}
          {!loading && (
            <View style={{ alignItems: "center", marginBottom: isTablet ? 28 : 22 }}>
              <Image
                source={{ uri: HEADER_IMAGE }}
                style={{ width: headerImgW, maxWidth: isTablet ? 250 : 240, height: undefined, aspectRatio: 3.4, borderRadius: 12 }}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Tab bar — constrained to same width as cards */}
          {!loading && !error && (
            <View style={{ maxWidth: maxW, alignSelf: "center", width: "100%", paddingHorizontal: sidePad }}>
              <TabBar active={activeTab} onChange={setActiveTab} isTablet={isTablet} />
            </View>
          )}

          {error && !loading && (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => fetchNews()} style={styles.retryBtn}>
                <Text style={styles.retryTx}>Retry</Text>
              </Pressable>
            </View>
          )}

          {!loading && !error && (
            <View style={{ gap: 10, maxWidth: maxW, alignSelf: "center", width: "100%", paddingHorizontal: sidePad }}>
              {visibleNews.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.errorText}>No articles found.</Text>
                </View>
              ) : (
                visibleNews.map((item, i) => (
                  <ArticleCard key={i} item={item} isTablet={isTablet} onPress={() => openArticle(item)} />
                ))
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ── ARTICLE VIEW ─────────────────────────────────────────────────── */}
      <Animated.View style={[styles.pane, { transform: [{ translateX: articleTranslateX }] }]}>
        {/* Back button */}
        <Pressable
          onPress={goBack}
          style={[styles.backBtn, { top: topPad + 4 }]}
          hitSlop={16}
        >
          <Feather name="chevron-left" size={isTablet ? 28 : 24} color={C.green} />
          <Text style={[styles.backTx, { fontSize: isTablet ? 17 : 15 }]}>
            {activeTab === "teamlists" ? "Team Lists" : "News"}
          </Text>
        </Pressable>

        {/* Full-screen centred loader — same pattern as list view */}
        {artLoading && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <NrlSpinner />
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: topPad + (isTablet ? 64 : 56),
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: sidePad,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ maxWidth: isTablet ? 980 : 860, alignSelf: "center", width: "100%" }}>
            {/* Header logo — same as list view */}
            {!artLoading && (
              <View style={{ alignItems: "center", marginBottom: isTablet ? 28 : 20 }}>
                <Image
                  source={{ uri: HEADER_IMAGE }}
                  style={{ width: headerImgW, maxWidth: isTablet ? 250 : 240, height: undefined, aspectRatio: 3.4, borderRadius: 12 }}
                  resizeMode="contain"
                />
              </View>
            )}

            {artError && !artLoading && (
              <View style={styles.center}>
                <Text style={styles.errorText}>{artError}</Text>
              </View>
            )}

            {article && !artLoading && (
              <>
                <View style={{ paddingHorizontal: 4, paddingBottom: isTablet ? 24 : 18 }}>
                  <Text style={[styles.artTitle, { fontSize: isTablet ? 28 : 21 }]}>{article.title}</Text>
                </View>
                {article.blocks.length > 0 ? (
                  <ArticleBody blocks={article.blocks} isTablet={isTablet} />
                ) : (
                  <View style={styles.center}>
                    <Text style={styles.errorText}>Couldn't extract article content.</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg, overflow: "hidden" },
  pane:      { ...StyleSheet.absoluteFillObject },
  hamburger: { position: "absolute", left: 14, zIndex: 100,
               width: 36, height: 36, borderRadius: 10,
               backgroundColor: "rgba(255,255,255,0.08)",
               alignItems: "center", justifyContent: "center" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  errorText: { color: C.muted, fontSize: 15, textAlign: "center", marginBottom: 16 },
  retryBtn:  { borderWidth: 1, borderColor: C.green, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryTx:   { color: C.green, fontSize: 14, fontWeight: "600" },
  backBtn: {
    position: "absolute", left: 12, zIndex: 100,
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  backTx:    { color: C.green, fontWeight: "600", letterSpacing: -0.1 },
  artTitle:  {
    color: C.text, fontWeight: "800", lineHeight: 32,
    letterSpacing: -0.3, textAlign: "center",
  },
});
