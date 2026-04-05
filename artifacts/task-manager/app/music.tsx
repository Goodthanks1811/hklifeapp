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

const RED    = "#E8230A";
const BG     = "#0b0b0c";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#888";

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 52;
const MIN_H = 6;

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

function ProviderRow({
  iconName,
  label,
  accentColor,
  iconColor,
  onPress,
}: {
  iconName: string;
  label: string;
  accentColor: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]} onPress={onPress}>
      <View style={[s.accentBar, { backgroundColor: accentColor }]} />
      <View style={s.iconCell}>
        <Feather name={iconName as any} size={22} color={iconColor} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      <Feather name="chevron-right" size={16} color={BORDER} />
    </Pressable>
  );
}

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.eqWrap}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <EqBar key={i} index={i} />
          ))}
        </View>

        <View style={s.cards}>
          <ProviderRow
            iconName="music"
            iconColor={RED}
            accentColor={RED}
            label="My Music"
            onPress={() => router.push("/music-mymusic" as any)}
          />
          <ProviderRow
            iconName="headphones"
            iconColor="#1DB954"
            accentColor="#1DB954"
            label="Spotify"
            onPress={() => router.push("/music-spotify" as any)}
          />
          <ProviderRow
            iconName="headphones"
            iconColor={RED}
            accentColor={RED}
            label="Apple Music"
            onPress={() => router.push("/music-apple" as any)}
          />
        </View>

        <View style={s.divider} />

        <Text style={s.npHeading}>NOW PLAYING</Text>

        <View style={s.npCard}>
          <View style={s.npTop}>
            <View style={s.npArt}>
              <Feather name="music" size={30} color={RED} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.npTitle} numberOfLines={1}>Regulate Remix</Text>
              <Text style={s.npArtist} numberOfLines={1}>Warren G Feat Nate Dogg</Text>
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
              <Feather name="play" size={24} color="#fff" />
            </Pressable>
            <Pressable style={s.ctrlBtn}>
              <Feather name="skip-forward" size={26} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 520, alignSelf: "center", width: "100%" },
  scroll: { paddingBottom: 48 },

  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 100, paddingTop: 44,
  },
  eqBar: { width: 5, borderRadius: 3, backgroundColor: RED },

  cards: { paddingHorizontal: 16, gap: 10, paddingTop: 32 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 16, height: 84, paddingHorizontal: 20,
    overflow: "hidden", position: "relative",
  },
  rowPressed: { opacity: 0.75 },
  accentBar: {
    position: "absolute", left: 0, top: 16, bottom: 16,
    width: 3, borderRadius: 2,
  },
  iconCell: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: {
    flex: 1, fontSize: 17, fontWeight: "600", color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },

  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 16, marginTop: 28 },

  npHeading: {
    textAlign: "center", color: "#fff",
    fontSize: 13, fontWeight: "700", letterSpacing: 3,
    paddingTop: 22, paddingBottom: 14,
    fontFamily: "Inter_700Bold",
  },

  npCard: {
    marginHorizontal: 16, backgroundColor: ROW,
    borderWidth: 1, borderColor: BORDER, borderRadius: 20,
    padding: 22,
  },
  npTop: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 18 },
  npArt: {
    width: 80, height: 80, borderRadius: 14,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  npTitle:  { fontSize: 18, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  npArtist: { fontSize: 14, color: GREY, fontFamily: "Inter_400Regular" },
  progressWrap: {
    height: 4, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, marginBottom: 22, overflow: "hidden",
  },
  progressFill: { width: "38%", height: "100%", backgroundColor: RED, borderRadius: 2 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 36 },
  ctrlBtn:  { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.45,
  },
});
