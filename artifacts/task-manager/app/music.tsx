import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useDrawer } from "@/context/DrawerContext";
import { useMusicPlayer } from "@/context/MusicPlayerContext";
import { useAppleMusicPlayer } from "@/context/AppleMusicPlayerContext";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

const RED    = "#E8230A";
const BG     = "#111111";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#888";

function MusicTitle() {
  return (
    <MaskedView
      style={{ alignSelf: "center" }}
      maskElement={
        <Text style={{ fontFamily: "BebasNeue_400Regular", fontSize: 58, letterSpacing: 4, backgroundColor: "transparent" }}>
          Music
        </Text>
      }
    >
      <LinearGradient
        colors={["#FF2020", "#8B0000"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={{ fontFamily: "BebasNeue_400Regular", fontSize: 58, letterSpacing: 4, opacity: 0 }}>
          Music
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

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
  const insets   = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;
  const { openDrawer } = useDrawer();
  const player = useMusicPlayer();
  const am     = useAppleMusicPlayer();

  const playerVisible = !!(player.track || am.nowPlaying);
  // Mini bar: bottom:20 offset + paddingTop(14)+content(36)+paddingBottom(14) + safe-area spacer + breathing room
  const playerH = playerVisible ? (84 + Math.max(insets.bottom - 8, 6) + 20) : 0;

  const goHome = () => { openDrawer(); };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>

        <View style={[s.body, { paddingBottom: playerVisible ? playerH : 36 }]}>
          <View style={s.headerArea}>
            <Pressable style={s.eqArea} onPress={goHome}>
              <View style={s.eqWrap}>
                {Array.from({ length: BAR_COUNT }).map((_, i) => (
                  <EqBar key={i} index={i} />
                ))}
              </View>
            </Pressable>
            <MusicTitle />
            <Pressable style={s.backZone} onPress={goHome} />
          </View>

          <View style={s.cards}>
            <ProviderRow
              icon={<Feather name="music" size={32} color={RED} />}
              accentColor={RED}
              label="My Music"
              onPress={() => router.push("/music-mymusic" as any)}
            />
            <ProviderRow
              icon={<MaterialCommunityIcons name="spotify" size={36} color="#1DB954" />}
              accentColor="#1DB954"
              label="Spotify"
              onPress={() => router.push("/music-spotify" as any)}
            />
            <ProviderRow
              icon={<Text style={s.appleEmoji}>🍎</Text>}
              accentColor={RED}
              label="Apple Music"
              onPress={() => router.push("/music-apple" as any)}
            />
          </View>
        </View>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 800, alignSelf: "center", width: "100%" },

  body: {
    flex: 1, justifyContent: "space-between",
    paddingTop: 36,
  },

  headerArea: { position: "relative", alignItems: "center" },
  backZone:   { position: "absolute", left: 0, top: 0, bottom: 0, right: "50%" },
  eqArea: { alignItems: "center" },
  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 80, paddingTop: 0,
  },
  eqBar: { width: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },

  cards:      { paddingHorizontal: 16, gap: 10, paddingTop: 20 },
  appleEmoji: { fontSize: 30, lineHeight: 34 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 16, height: 84, paddingHorizontal: 20,
    position: "relative",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  rowPressed: { opacity: 0.75 },
  accentBar: {
    position: "absolute", left: 0, top: 16, bottom: 16,
    width: 3, borderRadius: 2,
  },
  iconCell: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: ROW,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: {
    flex: 1, fontSize: 17, fontWeight: "600", color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },

  playerPanel: {
    backgroundColor: ROW,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 20,
  },
  npTop:   { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 },
  npArt: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  npTitle:  { fontSize: 15, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  npArtist: { fontSize: 13, color: GREY, fontFamily: "Inter_400Regular" },
  progressHitArea: { height: 24, justifyContent: "center", marginBottom: 4 },
  timeRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  timeText: { fontSize: 12, fontFamily: "Inter_400Regular", color: GREY },
  progressTrack: {
    height: 4, backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2, overflow: "visible",
  },
  progressFill: {
    height: "100%", backgroundColor: RED,
    borderRadius: 2, overflow: "visible",
  },
  progressThumb: {
    position: "absolute", right: -6, top: -4,
    width: 12, height: 12, borderRadius: 6, backgroundColor: RED,
  },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 14 },
  ctrlBtn:  { width: 62, height: 62, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.45,
  },
});
