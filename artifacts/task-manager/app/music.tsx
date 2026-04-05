import React, { useEffect } from "react";
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

const RED = "#E8230A";
const BG  = "#0b0b0c";
const ROW = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY = "#888";

const BAR_COUNT = 7;
const BAR_DELAYS = [0, 180, 360, 80, 270, 140, 420];
const BAR_DURATIONS = [1100, 1300, 1000, 1400, 1200, 1050, 1350];
const MAX_H = 52;
const MIN_H = 6;

function EqBar({ index }: { index: number }) {
  const height = useSharedValue(MIN_H);

  useEffect(() => {
    const timeout = setTimeout(() => {
      height.value = withRepeat(
        withSequence(
          withTiming(MAX_H, { duration: BAR_DURATIONS[index] / 2, easing: Easing.inOut(Easing.sine) }),
          withTiming(MIN_H, { duration: BAR_DURATIONS[index] / 2, easing: Easing.inOut(Easing.sine) }),
        ),
        -1,
        false,
      );
    }, BAR_DELAYS[index]);
    return () => clearTimeout(timeout);
  }, []);

  const style = useAnimatedStyle(() => ({ height: height.value }));

  return <Animated.View style={[s.eqBar, style]} />;
}

function ProviderRow({
  icon,
  label,
  accentColor,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]} onPress={onPress}>
      <View style={[s.accentBar, { backgroundColor: accentColor }]} />
      <View style={s.iconCell}>{icon}</View>
      <Text style={s.rowLabel}>{label}</Text>
      <Feather name="chevron-right" size={16} color={BORDER} />
    </Pressable>
  );
}

export default function MusicScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.ambient} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.eqWrap}>
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <EqBar key={i} index={i} />
          ))}
        </View>

        <Text style={s.sectionLabel}>SOURCES</Text>

        <View style={s.cards}>
          <ProviderRow
            accentColor={RED}
            icon={
              <Feather name="music" size={22} color={RED} />
            }
            label="My Music"
            onPress={() => router.push("/music-mymusic" as any)}
          />
          <ProviderRow
            accentColor="#1DB954"
            icon={
              <Feather name="headphones" size={22} color="#1DB954" />
            }
            label="Spotify"
            onPress={() => router.push("/music-spotify" as any)}
          />
          <ProviderRow
            accentColor={RED}
            icon={
              <Feather name="headphones" size={22} color={RED} />
            }
            label="Apple Music"
            onPress={() => router.push("/music-apple" as any)}
          />
        </View>

        <View style={s.divider} />
        <Text style={s.sectionLabel}>NOW PLAYING</Text>

        <View style={s.npCard}>
          <View style={s.npTop}>
            <View style={s.npArt}>
              <Feather name="music" size={20} color={RED} />
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
              <Feather name="skip-back" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Pressable style={s.playBtn}>
              <Feather name="play" size={18} color="#fff" />
            </Pressable>
            <Pressable style={s.ctrlBtn}>
              <Feather name="skip-forward" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  ambient: {
    position: "absolute", top: -120, alignSelf: "center",
    width: 340, height: 340, borderRadius: 170,
    backgroundColor: "transparent",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 120, shadowOpacity: 0.12,
  },

  scroll: { paddingBottom: 40 },

  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 100, paddingTop: 44, paddingBottom: 0,
  },
  eqBar: {
    width: 5, borderRadius: 3, backgroundColor: RED,
  },

  sectionLabel: {
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10,
    fontSize: 11, letterSpacing: 3, color: GREY,
    fontFamily: "Inter_500Medium",
  },

  cards: { paddingHorizontal: 16, gap: 10 },
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

  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 16, marginTop: 24 },

  npCard: {
    marginHorizontal: 16, backgroundColor: ROW,
    borderWidth: 1, borderColor: BORDER, borderRadius: 16,
    padding: 16,
  },
  npTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  npArt: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  npTitle: { fontSize: 14, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold" },
  npArtist: { fontSize: 12, color: GREY, marginTop: 2, fontFamily: "Inter_400Regular" },
  progressWrap: {
    height: 2, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1, marginBottom: 14, overflow: "hidden",
  },
  progressFill: { width: "38%", height: "100%", backgroundColor: RED, borderRadius: 1 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  ctrlBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.4,
  },
});
