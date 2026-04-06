import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

type SpotifyPL = { name: string; url: string };

const DEFAULT_PLAYLISTS: SpotifyPL[] = [
  { name: "Liked Songs",      url: "spotify://collection/tracks" },
  { name: "January 2026",     url: "spotify://playlist/2MwL8nIietYcMDHb4YaO8R?si=AYhQI2eASgSuTXJxAv0QoQ&pi=MkwaUygfSHSKb" },
  { name: "The Game",         url: "spotify://playlist/2NvbWjiow97CpX3ZuTewVd?si=GfxpBK7ISGWA8iG73G_SjA&pi=3oKvGMXsQKOM1" },
  { name: "Krayzie Bone",     url: "spotify://playlist/0AaZ9pO9JLDNzrGwkLQms9?si=G0rrS01DRqGNPsOXnYGjqQ&pi=a-NgLJdujPRYij" },
  { name: "October 2025",     url: "spotify://playlist/7gEbs45sKp9Bd7xoQpS9RB?si=fyr3oOWRQBmPPxE2a_FrkQ&pi=BgbSg8ZkQuKmM&add=1" },
  { name: "Spanish",          url: "spotify://playlist/2UFK9fljpU7TIYnAx1v9Za?si=5KtFrzuuTcCvix7oOjb7ig&pi=ph-Qxgk0QPic" },
  { name: "January 2024",     url: "spotify://playlist/3DI4nKtBqyq9anP4RSdJ7G?si=w8cWQrlbQ1ycUbRhDMW_jw&pi=Q_VF0U4EQ7-1O/" },
  { name: "Repeat 2023",      url: "spotify://playlist/5wItz7OUdUPIj9VNzBi9jr?si=zEHmbbmfQNS9pEHHneza7Q&pi=BK14ACn0S1KQV" },
  { name: "Life",             url: "spotify://playlist/7A7nzaXeOuAiTRdRzOQ64H?si=z1-VlOfxR1awOGPHBOUjPA&pi=XjlBmTebRtiNB" },
  { name: "September 2022",   url: "spotify://playlist/5G1ZOG3K4srwBr6Y2gdLCi?si=wManU4LNRly01VsODI2kbA&pi=IPovAIyWT26bK" },
];

export default function MusicSpotifyScreen() {
  const goBack = () => router.back();
  const [playlists, setPlaylists] = useState<SpotifyPL[]>(DEFAULT_PLAYLISTS);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem("music_spotify_playlists").then(v => {
      if (v) setPlaylists(JSON.parse(v));
    });
  }, []));
  const insets = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  const openPlaylist = (url: string) => {
    if (!url) {
      Linking.openURL("spotify://").catch(() => Linking.openURL("https://open.spotify.com"));
      return;
    }
    Linking.openURL(url).catch(() => Linking.openURL("https://open.spotify.com"));
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
      <View style={s.headerArea}>
        <Pressable style={s.eqWrap} onPress={goBack}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <EqBar key={i} index={i} color={GREEN} />
          ))}
        </Pressable>
        <Text style={s.pageTitle}>Spotify</Text>
        <Pressable style={s.backZone} onPress={goBack} />
      </View>

      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {playlists.map((pl, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={() => openPlaylist(pl.url)}
          >
            <View style={s.iconCell}>
              <Feather name="headphones" size={20} color={GREEN} />
            </View>
            <Text style={s.rowName}>{pl.name}</Text>
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
    paddingTop: 28, paddingBottom: 10,
    position: "relative",
  },
  backZone: { position: "absolute", left: 0, top: 0, bottom: 0, width: 80 },

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
