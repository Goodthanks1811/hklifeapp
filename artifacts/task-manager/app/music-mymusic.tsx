import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

const RED    = "#E03131";
const BG     = "#0b0b0c";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#A0A0A0";

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

function EqBar({ index }: { index: number }) {
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

  return <Animated.View style={[s.eqBar, { height }]} />;
}

const TRACKS = [
  "Zack Knight - Impossible",
  "Tyga Feat Saweetie & G-Eazy - Big Booty Bitch",
  "Ryan Leslie Feat Jermaine Dupri - The Way That You Move Girl Remix",
  "Warren G Feat Nate Dogg - Regulate Remix",
  "Reik Feat Ozuna - Me Niego (New)",
  "Krayzie Bone - Clash Of The Titans",
  "Krayzie Bone & Bizzy Bone - Warriors 3",
  "Plot Twist Accapella Slowed",
  "Jagged Edge - So Amazing",
  "Carnal - Amor Reencarnado",
  "The Weeknd - Blinding Lights",
  "Drake - God's Plan",
];

const NOW_PLAYING = 3;

export default function MusicMyMusicScreen() {
  const insets = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
      <View style={s.headerArea}>
        <View style={s.navRow}>
          <Pressable style={s.back} onPress={() => router.back()}>
            <Feather name="chevron-left" size={20} color={RED} />
            <Text style={s.backText}>Music</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={s.addBtn}>
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={s.eqWrap}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <EqBar key={i} index={i} />
          ))}
        </View>
        <Text style={s.pageTitle}>My Music</Text>
      </View>

      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {TRACKS.map((name, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [s.trackRow, pressed && s.trackPressed]}
          >
            <View style={s.trackIcon}>
              <Feather name="music" size={18} color={RED} />
            </View>
            <View style={s.trackInfo}>
              <Text
                style={[s.trackName, i === NOW_PLAYING && s.trackNamePlaying]}
                numberOfLines={2}
              >
                {name}
              </Text>
            </View>
            <Pressable style={s.dots} hitSlop={8}>
              <Feather name="more-vertical" size={16} color="rgba(255,255,255,0.25)" />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[s.player, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.playerTrack}>
          <View style={s.playerArt}>
            <Feather name="music" size={18} color={RED} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.playerName} numberOfLines={1}>{TRACKS[NOW_PLAYING]}</Text>
            <Text style={s.playerArtist} numberOfLines={1}>Warren G Feat Nate Dogg</Text>
          </View>
        </View>
        <View style={s.progressWrap}>
          <View style={s.progressFill} />
        </View>
        <View style={s.controls}>
          <Pressable style={s.ctrlBtn}>
            <Feather name="skip-back" size={26} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Pressable style={s.playBtn}>
            <Feather name="play" size={22} color="#fff" />
          </Pressable>
          <Pressable style={s.ctrlBtn}>
            <Feather name="skip-forward" size={26} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
      </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 520, alignSelf: "center", width: "100%" },

  headerArea: {
    backgroundColor: BG,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    paddingBottom: 10,
  },
  navRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  back:     { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: RED, fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },
  addBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: RED, alignItems: "center", justifyContent: "center" },

  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 62, paddingBottom: 4,
  },
  eqBar: { width: 5, borderRadius: 3, backgroundColor: RED },

  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    paddingTop: 8,
  },

  list:        { flex: 1 },
  listContent: { padding: 16, gap: 8 },

  trackRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 10,
  },
  trackPressed: { opacity: 0.7 },
  trackIcon: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  trackInfo:        { flex: 1 },
  trackName:        { fontSize: 13.5, fontWeight: "500", color: "#fff", lineHeight: 18, fontFamily: "Inter_500Medium" },
  trackNamePlaying: { color: RED },
  dots:             { padding: 4 },

  player: {
    backgroundColor: ROW, borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 10,
  },
  playerTrack: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  playerArt: {
    width: 42, height: 42, borderRadius: 9,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  playerName:   { fontSize: 13, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold" },
  playerArtist: { fontSize: 11, color: GREY, marginTop: 1, fontFamily: "Inter_400Regular" },
  progressWrap: {
    height: 3, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, marginBottom: 10, overflow: "hidden",
  },
  progressFill: { width: "32%", height: "100%", backgroundColor: RED, borderRadius: 2 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 36 },
  ctrlBtn:  { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 14, shadowOpacity: 0.38,
  },
});
