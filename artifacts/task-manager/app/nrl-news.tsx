import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { useDrawer } from "@/context/DrawerContext";
import Colors from "@/constants/colors";

const BASE_URL     = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
const HEADER_IMAGE = "https://i.postimg.cc/8CFL755P/IMG-4791.png";
const NRL_GREEN    = "#00D85B";

// ── Types ──────────────────────────────────────────────────────────────────────
interface NewsItem     { title: string; link: string; pubDate: string; category: string; _blocked?: boolean }
interface ArticleBlock { type: "heading" | "paragraph"; text: string }
interface Article      { title: string; blocks: ArticleBlock[] }

// ── Green ring spinner ─────────────────────────────────────────────────────────
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
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 4,
    borderColor: "#1a1a1a",
    borderTopColor: NRL_GREEN,
    borderRightColor: NRL_GREEN,
  },
});

// ── NRL logo — identical sizing to Schedule page (.header-banner) ─────────────
function NrlLogo() {
  return (
    <View style={logo.row}>
      <Image
        source={{ uri: HEADER_IMAGE }}
        style={logo.img}
        resizeMode="contain"
      />
    </View>
  );
}
const logo = StyleSheet.create({
  row: { alignItems: "center", paddingTop: 4, paddingBottom: 8, backgroundColor: "#000" },
  img: { height: 115, width: "100%" },
});

// ── Article card — Chest row style, no chevron ─────────────────────────────────
function ArticleCard({ item, onPress }: { item: NewsItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ac.row, pressed && { opacity: 0.75 }]}
    >
      <Text style={ac.title} numberOfLines={2}>{item.title}</Text>
    </Pressable>
  );
}
const ac = StyleSheet.create({
  row: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    minHeight: 48,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 21,
  },
});

// ── Article body ───────────────────────────────────────────────────────────────
function ArticleBody({ blocks, isTablet }: { blocks: ArticleBlock[]; isTablet: boolean }) {
  const textSize    = isTablet ? 16 : 15;
  const headingSize = isTablet ? 19 : 17;
  return (
    <View style={ab.body}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const showDivider = i > 0 && blocks[i - 1]?.type !== "heading";
          return (
            <View key={i}>
              {showDivider && (
                <View style={[ab.divider, { marginTop: isTablet ? 32 : 26, marginBottom: isTablet ? 16 : 12 }]} />
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
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: "#0f0f0f",
    borderRadius: 10,
    padding: 18,
    overflow: "hidden",
  },
  heading: { color: "#fff", fontFamily: "Inter_700Bold", lineHeight: 28, letterSpacing: -0.3 },
  para:    { color: "#fff", fontFamily: "Inter_400Regular", letterSpacing: -0.1 },
  divider: { height: 3, borderRadius: 4, marginHorizontal: 10, backgroundColor: NRL_GREEN },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function NrlNewsScreen() {
  const insets             = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const isTablet           = screenW >= 768;

  const { openDrawer } = useDrawer();

  const [news,       setNews]       = useState<NewsItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [article,    setArticle]    = useState<Article | null>(null);
  const [artLoading, setArtLoading] = useState(false);
  const [artError,   setArtError]   = useState<string | null>(null);

  // Transition anim: 0 = list, 1 = article
  const viewAnim = useRef(new Animated.Value(0)).current;

  const topPad  = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const sidePad = isTablet ? 20 : 16;
  const maxW    = isTablet ? 860 : 600;

  const visibleNews = news.filter(x => !x._blocked);

  // ── Fetch ────────────────────────────────────────────────────────────────────
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

  return (
    <View style={styles.root}>

      {/* ── LIST VIEW ────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.pane, { transform: [{ translateX: listTranslateX }], backgroundColor: "#000" }]}>
        {/* Invisible left-half tap zone to open drawer */}
        <Pressable
          style={styles.backZone}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openDrawer(); }}
        />

        {loading && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <NrlSpinner />
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: topPad + 74,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNews(true)}
              tintColor={NRL_GREEN}
              colors={[NRL_GREEN]}
            />
          }
        >
          {/* NRL logo — same sizing as Schedule page */}
          {!loading && <NrlLogo />}

          <View style={{ paddingTop: 16, paddingHorizontal: sidePad, maxWidth: maxW, alignSelf: "center", width: "100%" }}>
            {error && !loading && (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => fetchNews()} style={styles.retryBtn}>
                  <Text style={styles.retryTx}>Retry</Text>
                </Pressable>
              </View>
            )}

            {!loading && !error && (
              <View style={{ gap: 8 }}>
                {visibleNews.length === 0 ? (
                  <View style={styles.center}>
                    <Text style={styles.errorText}>No articles found.</Text>
                  </View>
                ) : (
                  visibleNews.map((item, i) => (
                    <ArticleCard key={i} item={item} onPress={() => openArticle(item)} />
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      {/* ── ARTICLE VIEW ─────────────────────────────────────────────────── */}
      <Animated.View style={[styles.pane, { transform: [{ translateX: articleTranslateX }], backgroundColor: "#000" }]}>
        {/* Back button — green */}
        <View style={{ paddingTop: topPad }}>
          <View style={styles.artHeader}>
            <Pressable onPress={goBack} style={styles.backBtn} hitSlop={16}>
              <Feather name="chevron-left" size={isTablet ? 28 : 24} color={NRL_GREEN} />
              <Text style={[styles.backTx, { fontSize: isTablet ? 17 : 15 }]}>News</Text>
            </Pressable>
          </View>
        </View>

        {artLoading && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <NrlSpinner />
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {!artLoading && <NrlLogo />}

          <View style={{ paddingTop: 16, paddingHorizontal: sidePad, maxWidth: isTablet ? 860 : 600, alignSelf: "center", width: "100%" }}>
            {artError && !artLoading && (
              <View style={styles.center}>
                <Text style={styles.errorText}>{artError}</Text>
              </View>
            )}

            {article && !artLoading && (
              <>
                <View style={{ paddingBottom: isTablet ? 24 : 18 }}>
                  <Text style={[styles.artTitle, { fontSize: isTablet ? 26 : 20 }]}>{article.title}</Text>
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
  root:      { flex: 1, backgroundColor: Colors.darkBg },
  pane:      { ...StyleSheet.absoluteFillObject },
  backZone:  { position: "absolute", left: 0, top: 0, bottom: 0, right: "50%", zIndex: 10 },
  center:    { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  errorText: { color: Colors.textMuted, fontSize: 15, textAlign: "center", marginBottom: 16 },
  retryBtn:  { borderWidth: 1, borderColor: NRL_GREEN, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryTx:   { color: NRL_GREEN, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  artHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 4, paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.darkBg,
  },
  backBtn:   { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, paddingVertical: 6 },
  backTx:    { color: NRL_GREEN, fontFamily: "Inter_600SemiBold", letterSpacing: -0.1 },
  artTitle:  { color: "#fff", fontFamily: "Inter_700Bold", lineHeight: 30, letterSpacing: -0.3, textAlign: "center" },
});
