import React, { useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient as SvgGrad,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useAppleMusicPlayer } from "@/context/AppleMusicPlayerContext";

const RED    = "#E03131";
const BG     = "#0b0b0c";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const DIM    = "#1e1e1e";

const SCREEN_H = Dimensions.get("window").height;
const SCREEN_W = Dimensions.get("window").width;

// Spring configs — both directions use the same curve so open/close feel symmetrical.
// overshootClamping on close so the panel doesn't bounce at the bottom.
const OPEN_SPRING  = { damping: 44, stiffness: 380, mass: 1 } as const;
const CLOSE_SPRING = { damping: 44, stiffness: 380, mass: 1, overshootClamping: true } as const;
const SNAP_SPRING  = { damping: 30, stiffness: 300, mass: 1 } as const;

// ── SVG icons ─────────────────────────────────────────────────────────────────
function MusicNoteIcon() {
  return (
    <Svg width={110} height={120} viewBox="0 0 110 120">
      <Defs>
        <SvgGrad id="ng" x1="20" y1="10" x2="90" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#ff7070" />
          <Stop offset="35%"  stopColor={RED} />
          <Stop offset="100%" stopColor="#5a0000" />
        </SvgGrad>
        <SvgGrad id="ng2" x1="20" y1="10" x2="90" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#ff9090" />
          <Stop offset="40%"  stopColor="#cc1010" />
          <Stop offset="100%" stopColor="#3a0000" />
        </SvgGrad>
      </Defs>
      <Rect x="52" y="12" width="10" height="72" rx="5" fill="url(#ng)" />
      <Path d="M62 12 C85 18, 88 30, 88 40 C88 52, 76 56, 62 52 C72 48, 80 42, 78 32 C76 22, 62 20, 62 20 Z" fill="url(#ng2)" />
      <Ellipse cx="42" cy="84" rx="18" ry="13" rotation="-15" originX="42" originY="84" fill="url(#ng)" />
      <Ellipse cx="38" cy="79" rx="9"  ry="5"  rotation="-15" originX="38" originY="79" fill="rgba(255,160,160,0.18)" />
      <Rect x="54" y="14" width="4" height="20" rx="2" fill="rgba(255,180,180,0.15)" />
    </Svg>
  );
}

function PrevIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32">
      <Rect x="5" y="7" width="3.5" height="18" rx="1.75" fill="#fff" />
      <Path d="M26 7L11 16L26 25Z" fill="#fff" />
    </Svg>
  );
}

function NextIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32">
      <Path d="M6 7L21 16L6 25Z" fill="#fff" />
      <Rect x="23.5" y="7" width="3.5" height="18" rx="1.75" fill="#fff" />
    </Svg>
  );
}

function PlayIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 26 26">
      <Path d="M8 4L22 13L8 22Z" fill="#fff" />
    </Svg>
  );
}

function PauseIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Rect x="5"  y="4" width="5" height="18" rx="2" fill="#fff" />
      <Rect x="16" y="4" width="5" height="18" rx="2" fill="#fff" />
    </Svg>
  );
}

function ShuffleIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M16 3l4 4-4 4M20 7H8c-2.8 0-5 2.2-5 5v.5M8 21l-4-4 4-4M4 17h12c2.8 0 5-2.2 5-5v-.5"
        stroke={active ? RED : "#3a3a3a"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

function RepeatIcon({ active }: { active: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
        stroke={active ? RED : "#3a3a3a"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export function AppleNowPlayingPanel({ insetBottom }: { insetBottom: number }) {
  const am     = useAppleMusicPlayer();
  const insets = useSafeAreaInsets();

  const [expanded, setExpanded] = useState(false);
  const [shuffle,  setShuffle]  = useState(false);
  const [repeat,   setRepeat]   = useState(false);

  // UI-thread shared values — both directions use withSpring so the curve is identical
  const slideY     = useSharedValue(SCREEN_H);
  const dragOffset = useSharedValue(0);

  const fsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value + dragOffset.value }],
  }));

  const expand = () => {
    setExpanded(true);
    slideY.value = withSpring(0, OPEN_SPRING);
  };

  const collapse = () => {
    // runOnJS fires only after the spring fully completes, preventing any mid-animation flash
    slideY.value = withSpring(SCREEN_H, CLOSE_SPRING, (finished) => {
      if (finished) runOnJS(setExpanded)(false);
    });
  };

  // Drag-to-dismiss — direct shared value writes run on UI thread immediately
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragOffset.value = g.dy;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) {
          dragOffset.value = 0;
          collapse();
        } else {
          dragOffset.value = withSpring(0, SNAP_SPRING);
        }
      },
    })
  ).current;

  if (!am.nowPlaying) return null;

  const title  = am.nowPlaying.title;
  const artist = am.nowPlaying.artist;

  return (
    <>
      {/* ── Mini bar (visible when collapsed) ── */}
      {!expanded && (
        <Pressable
          style={[s.miniBar, { paddingBottom: insetBottom + 12 }]}
          onPress={expand}
        >
          <Text style={s.miniTitle} numberOfLines={1}>{title}</Text>
          {artist ? <Text style={s.miniArtist} numberOfLines={1}>{artist}</Text> : null}

          <View style={s.miniControls}>
            <Pressable
              style={s.miniCtrlBtn}
              onPress={(e) => { e.stopPropagation(); am.skipToPrevious(); }}
            >
              <PrevIcon />
            </Pressable>

            <Pressable
              style={s.miniPlayBtn}
              onPress={(e) => { e.stopPropagation(); am.isPlaying ? am.pause() : am.play(); }}
            >
              {am.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </Pressable>

            <Pressable
              style={s.miniCtrlBtn}
              onPress={(e) => { e.stopPropagation(); am.skipToNext(); }}
            >
              <NextIcon />
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* ── Full-screen now playing — always rendered, slides in/out off-screen ── */}
      {expanded && (
        <Reanimated.View style={[s.fullScreen, fsAnimStyle]}>
          {/* Drag handle */}
          <View style={[s.dragZone, { paddingTop: insets.top + 8 }]} {...panResponder.panHandlers}>
            <View style={s.dragHandle} />
          </View>

          {/* Gradient header */}
          <View style={s.header}>
            <LinearGradient
              colors={[
                "rgba(224,49,49,0.90)",
                "rgba(215,42,42,0.74)",
                "rgba(190,28,28,0.56)",
                "rgba(145,16,16,0.38)",
                "rgba(90,8,8,0.20)",
                "rgba(35,3,3,0.08)",
                "#0f0f0f",
              ]}
              locations={[0, 0.18, 0.36, 0.54, 0.70, 0.85, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={s.navLbl}>Now Playing</Text>
          </View>

          {/* Album art */}
          <View style={s.artZone}>
            <View style={s.artBg}>
              <MusicNoteIcon />
            </View>
          </View>

          {/* Track info */}
          <View style={s.trackBlock}>
            <Text style={s.trackTitle} numberOfLines={1}>{title}</Text>
            <Text style={s.trackSub}   numberOfLines={1}>{artist}</Text>
          </View>

          {/* Scrub bar */}
          <View style={s.scrubBlock}>
            <View style={s.scrubTrack}>
              <View style={[s.scrubFill, { width: "0%" }]}>
                <View style={s.scrubDot} />
              </View>
            </View>
            <View style={s.scrubTimes}>
              <Text style={s.timeText}>0:00</Text>
              <Text style={s.timeText}>--:--</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={s.ctrlRow}>
            <Pressable style={s.iconBtn44} onPress={() => setShuffle(v => !v)}>
              <ShuffleIcon active={shuffle} />
            </Pressable>
            <Pressable style={s.iconBtn44} onPress={() => am.skipToPrevious()}>
              <PrevIcon />
            </Pressable>
            <Pressable
              style={s.playCircle}
              onPress={() => am.isPlaying ? am.pause() : am.play()}
            >
              {am.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </Pressable>
            <Pressable style={s.iconBtn44} onPress={() => am.skipToNext()}>
              <NextIcon />
            </Pressable>
            <Pressable style={s.iconBtn44} onPress={() => setRepeat(v => !v)}>
              <RepeatIcon active={repeat} />
            </Pressable>
          </View>

          {/* Collapse button */}
          <Pressable
            style={[s.collapseBtn, { bottom: insets.bottom + 24 }]}
            onPress={collapse}
          >
            <Text style={s.collapseTx}>Minimise</Text>
          </Pressable>
        </Reanimated.View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  miniBar: {
    backgroundColor: ROW,
    borderTopWidth: 1, borderTopColor: BORDER,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 14,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 20,
  },
  miniTitle: {
    fontSize: 15, fontWeight: "600", color: "#fff",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center", marginBottom: 2,
  },
  miniArtist: {
    fontSize: 12, color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
    textAlign: "center", marginBottom: 12,
  },
  miniControls: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 16,
  },
  miniCtrlBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  miniPlayBtn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: RED, alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14, shadowOpacity: 0.4,
  },

  fullScreen: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: BG,
    paddingHorizontal: 22,
  },
  dragZone: {
    alignItems: "center", paddingBottom: 10,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  header: {
    marginHorizontal: -22, paddingHorizontal: 20,
    paddingTop: 0, paddingBottom: 32,
    overflow: "hidden", backgroundColor: "#0f0f0f",
  },
  navLbl: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff",
    textAlign: "center", marginBottom: 4,
    textShadowColor: "rgba(224,49,49,0.45)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  artZone: { marginTop: 8, alignItems: "center" },
  artBg: {
    width: SCREEN_W - 44, height: SCREEN_W - 44,
    borderRadius: 16, backgroundColor: "#0a0a0a",
    borderWidth: 1, borderColor: "#222",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  trackBlock: { marginTop: 20 },
  trackTitle: {
    fontSize: 22, fontWeight: "700", color: "#fff",
    fontFamily: "Inter_700Bold", textAlign: "center",
  },
  trackSub: {
    fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 8,
    fontFamily: "Inter_400Regular", textAlign: "center",
  },
  scrubBlock: { marginTop: 28 },
  scrubTrack: {
    width: "100%", height: 4,
    backgroundColor: DIM, borderRadius: 2,
  },
  scrubFill: {
    height: "100%", backgroundColor: RED, borderRadius: 2,
    alignItems: "flex-end", justifyContent: "center",
  },
  scrubDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: RED, position: "absolute", right: -6,
  },
  scrubTimes: {
    flexDirection: "row", justifyContent: "space-between", marginTop: 6,
  },
  timeText: {
    fontSize: 10, color: "#fff", letterSpacing: 0.5,
    fontFamily: "Inter_600SemiBold",
  },
  ctrlRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 28,
  },
  iconBtn44: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  playCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: RED, alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16, shadowOpacity: 0.45,
  },
  collapseBtn: {
    position: "absolute", left: 0, right: 0, alignItems: "center",
  },
  collapseTx: {
    fontSize: 13, color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular", letterSpacing: 0.4,
  },
});
