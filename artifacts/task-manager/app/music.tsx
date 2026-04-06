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
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useMusicPlayer } from "@/context/MusicPlayerContext";

const RED    = "#E8230A";
const BG     = "#0b0b0c";
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

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function MusicScreen() {
  const insets  = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;
  const { openDrawer, skipNextAutoClose } = useDrawer();
  const player  = useMusicPlayer();

  const goHome = () => {
    skipNextAutoClose();
    router.replace("/life/automation" as any);
    openDrawer();
  };

  const hasTrack = player.track !== null;
  const progress = player.durMs > 0 ? player.posMs / player.durMs : 0;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>

        <View style={s.body}>
          <Pressable style={s.eqWrap} onPress={goHome}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <EqBar key={i} index={i} />
            ))}
          </Pressable>

          <MusicTitle />

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

        {/* Now playing panel — only shows when something is actually playing */}
        {hasTrack && (
          <View style={[s.playerPanel, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.npTop}>
              <View style={s.npArt}>
                <Feather name="music" size={30} color={RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.npTitle} numberOfLines={1}>
                  {player.track!.name}
                </Text>
                {player.durMs > 0 && (
                  <Text style={s.npArtist} numberOfLines={1}>
                    {fmtMs(player.posMs)} / {fmtMs(player.durMs)}
                  </Text>
                )}
              </View>
            </View>
            <View style={s.progressWrap}>
              <View style={[s.progressFill, { width: `${(progress * 100).toFixed(1)}%` }]} />
            </View>
            <View style={s.controls}>
              <Pressable style={s.ctrlBtn} onPress={() => player.skipBack()}>
                <Feather name="skip-back" size={26} color="rgba(255,255,255,0.6)" />
              </Pressable>
              <Pressable style={s.playBtn} onPress={() => player.togglePlay()}>
                <Feather name={player.isPlaying ? "pause" : "play"} size={24} color="#fff" />
              </Pressable>
              <Pressable style={s.ctrlBtn} onPress={() => player.skipForward()}>
                <Feather name="skip-forward" size={26} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>
          </View>
        )}

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 900, alignSelf: "center", width: "100%" },

  body: {
    flex: 1, justifyContent: "center", paddingBottom: 70,
  },

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

  playerPanel: {
    backgroundColor: ROW,
    paddingHorizontal: 20, paddingTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 20,
  },
  npTop:   { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  npArt: {
    width: 80, height: 80, borderRadius: 14,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  npTitle:  { fontSize: 18, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  npArtist: { fontSize: 13, color: GREY, fontFamily: "Inter_400Regular" },
  progressWrap: {
    height: 4, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, marginBottom: 30, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: RED, borderRadius: 2 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 36, marginBottom: 14 },
  ctrlBtn:  { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.45,
  },
});
