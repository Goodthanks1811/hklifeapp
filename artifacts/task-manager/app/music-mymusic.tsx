import React from "react";
import {
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
const BG     = "#111111";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#A0A0A0";

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

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={RED} />
          <Text style={s.backText}>Music</Text>
        </Pressable>
        <Text style={s.title}>My Music</Text>
        <Pressable style={s.addBtn}>
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
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

      <View style={[s.player, { paddingBottom: insets.bottom + 12 }]}>
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
            <Feather name="skip-back" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Pressable style={s.playBtn}>
            <Feather name="play" size={18} color="#fff" />
          </Pressable>
          <Pressable style={s.ctrlBtn}>
            <Feather name="skip-forward" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingBottom: 14, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  back:     { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  backText: { color: RED, fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },
  title:    { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold" },
  addBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: RED, alignItems: "center", justifyContent: "center" },

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
    paddingHorizontal: 20, paddingTop: 12,
  },
  playerTrack: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  playerArt: {
    width: 42, height: 42, borderRadius: 9,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  playerName:   { fontSize: 13, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold" },
  playerArtist: { fontSize: 11, color: GREY, marginTop: 1, fontFamily: "Inter_400Regular" },
  progressWrap: {
    height: 2, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1, marginBottom: 12, overflow: "hidden",
  },
  progressFill: { width: "32%", height: "100%", backgroundColor: RED, borderRadius: 1 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  ctrlBtn:  { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.35,
  },
});
