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

const RED    = "#E03131";
const BG     = "#0b0b0c";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

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

type ApplePL = { name: string; url: string };

const DEFAULT_PLAYLISTS: ApplePL[] = [
  { name: "Bone Greatest Hits",   url: "" },
  { name: "2pac Greatest Hits",   url: "" },
  { name: "Snoop Greatest Hits",  url: "" },
  { name: "DMX Greatest Hits",    url: "" },
  { name: "Eminem Greatest Hits", url: "" },
  { name: "The Repeat List",      url: "" },
  { name: "Old School Rnb",       url: "" },
  { name: "Driving",              url: "" },
  { name: "Pre Gym",              url: "" },
  { name: "2022 New Stuff",       url: "" },
  { name: "Faydee",               url: "" },
  { name: "Carnal Hits",          url: "" },
];

export default function MusicAppleScreen() {
  const [playlists, setPlaylists] = useState<ApplePL[]>(DEFAULT_PLAYLISTS);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem("music_apple_playlists").then(v => {
      if (v) setPlaylists(JSON.parse(v));
    });
  }, []));
  const insets = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  const openPlaylist = (pl: ApplePL) => {
    const target = pl.url.trim();
    if (target) {
      Linking.openURL(target).catch(() =>
        Linking.openURL("https://music.apple.com")
      );
    } else {
      Linking.openURL("music://").catch(() =>
        Linking.openURL("https://music.apple.com")
      );
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
      <View style={s.headerArea}>
        <Pressable style={s.eqWrap} onPress={() => router.back()}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <EqBar key={i} index={i} />
          ))}
        </Pressable>
        <Text style={s.pageTitle}>Apple Music</Text>
      </View>

      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {playlists.map((pl, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={() => openPlaylist(pl)}
          >
            <View style={s.iconCell}>
              <Feather name="headphones" size={18} color={RED} />
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
  },

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

  listContent: { padding: 16, gap: 8 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 14,
  },
  rowPressed: { opacity: 0.7 },
  iconCell: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  rowName: { flex: 1, fontSize: 15, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
});
