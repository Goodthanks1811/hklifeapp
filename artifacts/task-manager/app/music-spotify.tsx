import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

const GREEN  = "#1DB954";
const RED    = "#E03131";
const BG     = "#0b0b0c";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

function EqBar({ index, color }: { index: number; color: string }) {
  const height = useRef(new Animated.Value(MIN_H)).current;

  useEffect(() => {
    const dur = 900 + index * 120;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(height, {
          toValue: MAX_H * BAR_HEIGHTS[index],
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(height, {
          toValue: MIN_H,
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    const tid = setTimeout(() => anim.start(), BAR_DELAYS[index]);
    return () => {
      clearTimeout(tid);
      anim.stop();
    };
  }, []);

  return <Animated.View style={[s.eqBar, { height, backgroundColor: color }]} />;
}

const PLAYLISTS: { name: string; color: string }[] = [
  { name: "Liked Songs",       color: "#4B3B9E" },
  { name: "March 2026",        color: "#1a3a2a" },
  { name: "Sept 2022",         color: "#2a1a3a" },
  { name: "Carnal Favourites", color: "#3a1a1a" },
  { name: "Krayzie Bone",      color: "#1a2a3a" },
  { name: "October 2025",      color: "#2a3a1a" },
  { name: "Jony",              color: "#3a2a1a" },
  { name: "UB40",              color: "#1a3a3a" },
  { name: "Tyga Mix",          color: "#3a1a2a" },
  { name: "Old School RnB",    color: "#2a2a3a" },
];


export default function MusicSpotifyScreen() {
  const insets = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  const openSpotify = () => {
    Linking.openURL("spotify://").catch(() => Linking.openURL("https://open.spotify.com"));
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
      <View style={s.headerArea}>
        <View style={s.navRow}>
          <Pressable style={s.back} onPress={() => router.back()}>
            <Feather name="chevron-left" size={20} color={RED} />
            <Text style={s.backText}>Music</Text>
          </Pressable>
        </View>
        <View style={s.eqWrap}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <EqBar key={i} index={i} color={GREEN} />
          ))}
        </View>
        <Text style={s.pageTitle}>Spotify</Text>
      </View>

      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {PLAYLISTS.map((p, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={openSpotify}
          >
            <View style={s.iconCell}>
              <Feather name="headphones" size={20} color={GREEN} />
            </View>
            <Text style={s.rowName}>{p.name}</Text>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.2)" />
          </Pressable>
        ))}
      </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 900, alignSelf: "center", width: "100%" },

  headerArea: {
    backgroundColor: BG,
    paddingBottom: 10,
  },
  navRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  back:     { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: RED, fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },

  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 62, paddingBottom: 4,
  },
  eqBar: { width: 5, borderRadius: 3 },

  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    paddingTop: 8,
  },

  listContent: { padding: 16, gap: 8 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 10,
  },
  rowPressed:    { opacity: 0.7 },
  iconCell: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  rowName: { flex: 1, fontSize: 15, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
});
