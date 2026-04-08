import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient as SvgGrad,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useMusicPlayer } from "@/context/MusicPlayerContext";
import { useAppleMusicPlayer } from "@/context/AppleMusicPlayerContext";

const RED    = "#E03131";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const DIM    = "#1e1e1e";
const GREY   = "#888";
const BG     = "#0b0b0c";

const SCREEN_H = Dimensions.get("window").height;
const SCREEN_W = Dimensions.get("window").width;

// ── Music note SVG (from ui-kit design) ──────────────────────────────────────
function MusicNoteIcon() {
  return (
    <Svg width={110} height={120} viewBox="0 0 110 120">
      <Defs>
        <SvgGrad id="gng" x1="20" y1="10" x2="90" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#ff7070" />
          <Stop offset="35%"  stopColor={RED} />
          <Stop offset="100%" stopColor="#5a0000" />
        </SvgGrad>
        <SvgGrad id="gng2" x1="20" y1="10" x2="90" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#ff9090" />
          <Stop offset="40%"  stopColor="#cc1010" />
          <Stop offset="100%" stopColor="#3a0000" />
        </SvgGrad>
      </Defs>
      <Rect x="52" y="12" width="10" height="72" rx="5" fill="url(#gng)" />
      <Path d="M62 12 C85 18, 88 30, 88 40 C88 52, 76 56, 62 52 C72 48, 80 42, 78 32 C76 22, 62 20, 62 20 Z" fill="url(#gng2)" />
      <Ellipse cx="42" cy="84" rx="18" ry="13" rotation="-15" originX="42" originY="84" fill="url(#gng)" />
      <Ellipse cx="38" cy="79" rx="9"  ry="5"  rotation="-15" originX="38" originY="79" fill="rgba(255,160,160,0.18)" />
      <Rect x="54" y="14" width="4" height="20" rx="2" fill="rgba(255,180,180,0.15)" />
    </Svg>
  );
}

// ── Reusable interactive slider ───────────────────────────────────────────────
function SliderBar({
  value,
  onChange,
  height = 4,
  thumbSize = 12,
}: {
  value: number;
  onChange: (ratio: number) => void;
  height?: number;
  thumbSize?: number;
}) {
  const barRef   = useRef<View>(null);
  const barLeft  = useRef(0);
  const barWidth = useRef(0);
  const anim     = useRef(new Animated.Value(value)).current;
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) anim.setValue(value);
  }, [value]);

  const fillWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp" });

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      if (!barWidth.current) return;
      dragging.current = true;
      anim.setValue(Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current)));
    },
    onPanResponderMove: (e) => {
      if (!barWidth.current) return;
      anim.setValue(Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current)));
    },
    onPanResponderRelease: (e) => {
      dragging.current = false;
      if (!barWidth.current) return;
      const ratio = Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current));
      anim.setValue(ratio);
      onChange(ratio);
    },
    onPanResponderTerminate: () => { dragging.current = false; },
  })).current;

  return (
    <View
      ref={barRef}
      style={{ height: 24, justifyContent: "center" }}
      onLayout={() => {
        barRef.current?.measure((_fx, _fy, w, _h, px) => {
          barLeft.current  = px;
          barWidth.current = w;
        });
      }}
      {...pr.panHandlers}
    >
      <View style={{ height, backgroundColor: DIM, borderRadius: height / 2, overflow: "visible" }}>
        <Animated.View style={{ height: "100%", width: fillWidth, backgroundColor: RED, borderRadius: height / 2, overflow: "visible" }}>
          <View style={{
            position: "absolute", right: -thumbSize / 2, top: -(thumbSize - height) / 2,
            width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: RED,
          }} />
        </Animated.View>
      </View>
    </View>
  );
}

// ── Global persistent player ──────────────────────────────────────────────────
export function GlobalMusicPlayer() {
  const player = useMusicPlayer();
  const am     = useAppleMusicPlayer();
  const insets = useSafeAreaInsets();

  const [expanded, setExpanded] = useState(false);
  const [shuffle,  setShuffle]  = useState(false);
  const [repeat,   setRepeat]   = useState(false);

  // ── Full-screen slide animation (hooks MUST be before early return) ──────
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const dragY     = useRef(new Animated.Value(0)).current;
  const dragRef   = useRef(0);

  const expand = useCallback(() => {
    setExpanded(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 220 }).start();
  }, [slideAnim]);

  const collapse = useCallback(() => {
    Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 280, useNativeDriver: true })
      .start(() => { setExpanded(false); dragY.setValue(0); });
  }, [slideAnim, dragY]);

  const dismissPR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 8,
    onPanResponderMove: (_, g) => { if (g.dy > 0) { dragRef.current = g.dy; dragY.setValue(g.dy); } },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100 || g.vy > 0.9) {
        dragY.setValue(0);
        Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 280, useNativeDriver: true })
          .start(() => { setExpanded(false); dragY.setValue(0); });
      } else {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      }
      dragRef.current = 0;
    },
  })).current;

  // ── Determine active source ──────────────────────────────────────────────
  // Prefer whichever is actively playing; if both paused, prefer My Music if loaded
  const source: "mymusic" | "apple" | null =
    player.isPlaying ? "mymusic"
    : am.isPlaying   ? "apple"
    : player.track   ? "mymusic"
    : am.nowPlaying  ? "apple"
    : null;

  if (!source) return null;

  const title    = source === "mymusic" ? (player.track?.name ?? "") : (am.nowPlaying?.title ?? "");
  const artist   = "HK";
  const isPlay   = source === "mymusic" ? player.isPlaying : am.isPlaying;
  const posMs    = source === "mymusic" ? player.posMs : am.posMs;
  const durMs    = source === "mymusic" ? player.durMs : am.durMs;
  const vol      = source === "mymusic" ? player.volume : am.volume;
  const progress = durMs > 0 ? posMs / durMs : 0;

  const doToggle     = () => source === "mymusic" ? player.togglePlay() : (am.isPlaying ? am.pause() : am.play());
  const doSkipBack   = () => source === "mymusic" ? player.skipBack()   : am.skipToPrevious();
  const doSkipFwd    = () => source === "mymusic" ? player.skipForward() : am.skipToNext();
  const doSeek       = (r: number) => source === "mymusic" ? player.seekTo(r * durMs) : am.seekTo(r * durMs);
  const doSetVolume  = (r: number) => source === "mymusic" ? player.setVolume(r) : am.setVolume(r);

  function fmtMs(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <View style={s.outerWrap} pointerEvents="box-none">

      {/* ── Mini bar ── */}
      {!expanded && (
        <Pressable
          style={[s.miniBar, { paddingBottom: Math.max(insets.bottom + 20, 34) }]}
          onPress={expand}
        >
          {/* Track info */}
          <View style={[s.trackBlock, { marginTop: 0 }]}>
            <Text style={s.trackTitle} numberOfLines={1}>{title}</Text>
            {artist ? <Text style={s.trackSub} numberOfLines={1}>{artist}</Text> : null}
          </View>

          {/* Scrub bar */}
          <View style={[s.scrubSection, { marginTop: 10 }]}>
            <SliderBar value={progress} onChange={(r) => doSeek(r)} height={4} thumbSize={14} />
            <View style={s.timeRow}>
              <Text style={s.timeText}>{fmtMs(posMs)}</Text>
              <Text style={s.timeText}>{durMs > 0 ? fmtMs(durMs) : "--:--"}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={[s.ctrlRow, { marginTop: 16 }]}>
            <Pressable style={s.iconBtn} onPress={(e) => { e.stopPropagation(); setShuffle(v => !v); }}>
              <Ionicons name="shuffle" size={22} color={shuffle ? RED : "#3a3a3a"} />
            </Pressable>
            <Pressable style={s.iconBtn} onPress={(e) => { e.stopPropagation(); doSkipBack(); }}>
              <Ionicons name="play-skip-back" size={30} color="#fff" />
            </Pressable>
            <Pressable style={s.bigPlayBtn} onPress={(e) => { e.stopPropagation(); doToggle(); }}>
              <Ionicons name={isPlay ? "pause" : "play"} size={30} color="#fff" />
            </Pressable>
            <Pressable style={s.iconBtn} onPress={(e) => { e.stopPropagation(); doSkipFwd(); }}>
              <Ionicons name="play-skip-forward" size={30} color="#fff" />
            </Pressable>
            <Pressable style={s.iconBtn} onPress={(e) => { e.stopPropagation(); setRepeat(v => !v); }}>
              <Ionicons name="repeat" size={22} color={repeat ? RED : "#3a3a3a"} />
            </Pressable>
          </View>

          {/* Volume slider */}
          <View style={[s.volRow, { marginTop: 18 }]}>
            <Feather name="volume" size={14} color="#3a3a3a" />
            <View style={{ flex: 1 }}>
              <SliderBar value={vol} onChange={doSetVolume} height={3} thumbSize={12} />
            </View>
            <Feather name="volume-2" size={14} color="#3a3a3a" />
          </View>
        </Pressable>
      )}

      {/* ── Full-screen now playing ── */}
      {expanded && (
        <Animated.View
          style={[
            s.fullScreen,
            { transform: [{ translateY: Animated.add(slideAnim, dragY) }] },
          ]}
        >
          {/* Gradient top — covers drag handle all the way down through the title */}
          <View style={[s.gradHeader, { paddingTop: insets.top + 6 }]}>
            <LinearGradient
              colors={[
                "rgba(224,49,49,0.92)", "rgba(215,42,42,0.76)",
                "rgba(190,28,28,0.58)", "rgba(145,16,16,0.38)",
                "rgba(90,8,8,0.20)",   "rgba(35,3,3,0.08)", BG,
              ]}
              locations={[0, 0.18, 0.36, 0.54, 0.70, 0.86, 1]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Drag handle sits inside the gradient zone */}
            <View style={s.dragZone} {...dismissPR.panHandlers}>
              <View style={s.dragHandle} />
            </View>
            <Text style={s.navLbl}>Now Playing</Text>
          </View>

          {/* Artwork */}
          <View style={s.artZone}>
            <View style={s.artBg}>
              <MusicNoteIcon />
            </View>
          </View>

          {/* Track info */}
          <View style={s.trackBlock}>
            <Text style={s.trackTitle} numberOfLines={1}>{title}</Text>
            {artist ? <Text style={s.trackSub} numberOfLines={1}>{artist}</Text> : null}
          </View>

          {/* Scrub bar */}
          <View style={s.scrubSection}>
            <SliderBar value={progress} onChange={(r) => doSeek(r)} height={4} thumbSize={14} />
            <View style={s.timeRow}>
              <Text style={s.timeText}>{fmtMs(posMs)}</Text>
              <Text style={s.timeText}>{durMs > 0 ? fmtMs(durMs) : "--:--"}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={s.ctrlRow}>
            <Pressable style={s.iconBtn} onPress={() => setShuffle(v => !v)}>
              <Ionicons name="shuffle" size={22} color={shuffle ? RED : "#3a3a3a"} />
            </Pressable>
            <Pressable style={s.iconBtn} onPress={doSkipBack}>
              <Ionicons name="play-skip-back" size={30} color="#fff" />
            </Pressable>
            <Pressable style={s.bigPlayBtn} onPress={doToggle}>
              <Ionicons name={isPlay ? "pause" : "play"} size={30} color="#fff" />
            </Pressable>
            <Pressable style={s.iconBtn} onPress={doSkipFwd}>
              <Ionicons name="play-skip-forward" size={30} color="#fff" />
            </Pressable>
            <Pressable style={s.iconBtn} onPress={() => setRepeat(v => !v)}>
              <Ionicons name="repeat" size={22} color={repeat ? RED : "#3a3a3a"} />
            </Pressable>
          </View>

          {/* Volume slider */}
          <View style={s.volRow}>
            <Feather name="volume" size={14} color="#3a3a3a" />
            <View style={{ flex: 1 }}>
              <SliderBar value={vol} onChange={doSetVolume} height={3} thumbSize={12} />
            </View>
            <Feather name="volume-2" size={14} color="#3a3a3a" />
          </View>

          {/* Collapse */}
          <Pressable
            style={[s.collapseBtn, { bottom: insets.bottom + 20 }]}
            onPress={collapse}
          >
            <Feather name="chevron-down" size={20} color="rgba(255,255,255,0.35)" />
            <Text style={s.collapseTx}>Minimise</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  outerWrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
  },

  // ── Mini bar — edge-to-edge, anchored to bottom, covers safe area ───────────
  miniBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: ROW,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 20,
  },
  // ── Full screen ───────────────────────────────────────────────────────────
  fullScreen: {
    position: "absolute", top: 0, left: 0, right: 0, height: SCREEN_H,
    backgroundColor: BG, paddingHorizontal: 22,
  },
  dragZone: { alignItems: "center", paddingBottom: 10 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  gradHeader: {
    marginHorizontal: -22, paddingHorizontal: 20,
    paddingBottom: 30, overflow: "hidden",
  },
  navLbl: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center",
    textShadowColor: "rgba(224,49,49,0.45)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },
  artZone: { marginTop: 8, alignItems: "center" },
  artBg: {
    width: SCREEN_W - 80, height: SCREEN_W - 80, borderRadius: 16,
    backgroundColor: "#0a0a0a", borderWidth: 1, borderColor: "#222",
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
  scrubSection: { marginTop: 24 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  timeText: { fontSize: 10, color: "#fff", letterSpacing: 0.5, fontFamily: "Inter_600SemiBold" },
  ctrlRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 24,
  },
  iconBtn:    { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  bigPlayBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.45,
  },
  volRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 36,
  },
  collapseBtn: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
  },
  collapseTx: { fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular" },
});
