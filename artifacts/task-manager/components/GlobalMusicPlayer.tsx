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
import { usePathname } from "expo-router";
import { useMusicPlayer } from "@/context/MusicPlayerContext";
import { useAppleMusicPlayer } from "@/context/AppleMusicPlayerContext";

// ── System volume hook — reads hardware volume and listens for button changes ─
let _VolumeManager: any = null;
try { _VolumeManager = require("react-native-volume-manager").VolumeManager; } catch {}

function useSystemVolume() {
  const [sysVol, setSysVol] = useState<number>(1);

  useEffect(() => {
    if (!_VolumeManager) return;
    // Read current system volume
    _VolumeManager.getVolume().then((v: any) => {
      const val = typeof v === "object" ? (v.volume ?? v) : v;
      setSysVol(Math.max(0, Math.min(1, Number(val))));
    }).catch(() => {});
    // Listen for hardware button changes
    const sub = _VolumeManager.addVolumeListener((v: any) => {
      const val = typeof v === "object" ? (v.volume ?? v) : v;
      setSysVol(Math.max(0, Math.min(1, Number(val))));
    });
    return () => { try { sub?.remove?.(); } catch {} };
  }, []);

  const setSystemVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setSysVol(clamped);
    try { _VolumeManager?.setVolume(clamped, { showUI: false }); } catch {}
  }, []);

  return { sysVol, setSystemVolume };
}

const RED    = "#E03131";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const DIM    = "#1e1e1e";
const BG     = "#0b0b0c";

const SCREEN_W = Dimensions.get("window").width;

// ── Music note SVG ────────────────────────────────────────────────────────────
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
  color = RED,
}: {
  value: number;
  onChange: (ratio: number) => void;
  height?: number;
  thumbSize?: number;
  color?: string;
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

  const measure = () => {
    barRef.current?.measureInWindow((x, _y, w) => {
      barLeft.current  = x;
      barWidth.current = w;
    });
  };

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      dragging.current = true;
      if (!barWidth.current) return;
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
      style={{ height: 36, justifyContent: "center" }}
      onLayout={measure}
      {...pr.panHandlers}
    >
      <View style={{ height, backgroundColor: DIM, borderRadius: height / 2, overflow: "visible" }}>
        <Animated.View style={{ height: "100%", width: fillWidth, backgroundColor: color, borderRadius: height / 2, overflow: "visible" }}>
          <View style={{
            position: "absolute", right: -thumbSize / 2, top: -(thumbSize - height) / 2,
            width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: color,
          }} />
        </Animated.View>
      </View>
    </View>
  );
}

// ── Global persistent player ──────────────────────────────────────────────────
export function GlobalMusicPlayer() {
  const player   = useMusicPlayer();
  const am       = useAppleMusicPlayer();
  const insets   = useSafeAreaInsets();
  const pathname = usePathname();

  const [expanded, setExpanded] = useState(false);
  const [shuffle,  setShuffle]  = useState(false);
  const [repeat,   setRepeat]   = useState(false);

  // Hide mini player (but not full-screen) on music pages
  const isOnMusicPage = pathname === "/music"
    || pathname.startsWith("/music-")
    || pathname.startsWith("/music/");

  // ── Full-screen slide animation (hooks MUST be before early return) ──────
  const slideAnim  = useRef(new Animated.Value(Dimensions.get("window").height)).current;
  const dragY      = useRef(new Animated.Value(0)).current;
  const dismissing = useRef(false);

  const expand = useCallback(() => {
    dismissing.current = false; // only place we reset — prevents double-fire
    setExpanded(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 220 }).start();
  }, [slideAnim]);

  const collapse = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    dragY.setValue(0);
    Animated.timing(slideAnim, { toValue: Dimensions.get("window").height, duration: 280, useNativeDriver: true })
      .start(({ finished }) => {
        if (finished) { setExpanded(false); dragY.setValue(0); }
      });
    // dismissing.current is ONLY reset in expand() — guards against any re-entry
  }, [slideAnim, dragY]);

  // Keep a stable ref so the PanResponder (created once) always calls the live collapse
  const collapseRef = useRef(collapse);
  useEffect(() => { collapseRef.current = collapse; }, [collapse]);

  // Swipe-down pan responder — full-screen, only activates on clear downward drag
  const dismissPR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder:  (_, g) => !dismissing.current && g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.8,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) dragY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.8) {
        collapseRef.current();
      } else {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => {
      if (!dismissing.current) {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  // ── System volume (hardware scale) ──────────────────────────────────────
  const { sysVol, setSystemVolume } = useSystemVolume();

  // ── Determine active source ──────────────────────────────────────────────
  const source: "mymusic" | "apple" | null =
    player.isPlaying ? "mymusic"
    : am.isPlaying   ? "apple"
    : player.track   ? "mymusic"
    : am.nowPlaying  ? "apple"
    : null;

  if (!source) return null;

  const title    = source === "mymusic" ? (player.track?.name ?? "") : (am.nowPlaying?.title ?? "");
  const artist   = source === "mymusic" ? ((player.track as any)?.artist ?? "") : (am.nowPlaying?.artist ?? "");
  const isPlay   = source === "mymusic" ? player.isPlaying : am.isPlaying;
  const posMs    = source === "mymusic" ? player.posMs : am.posMs;
  const durMs    = source === "mymusic" ? player.durMs : am.durMs;
  const progress = durMs > 0 ? posMs / durMs : 0;

  const doToggle    = () => source === "mymusic" ? player.togglePlay() : (am.isPlaying ? am.pause() : am.play());
  const doSkipBack  = () => source === "mymusic" ? player.skipBack()   : am.skipToPrevious();
  const doSkipFwd   = () => source === "mymusic" ? player.skipForward() : am.skipToNext();
  const doSeek      = (r: number) => source === "mymusic" ? player.seekTo(r * durMs) : am.seekTo(r * durMs);
  const doSetVolume = (r: number) => setSystemVolume(r);

  function fmtMs(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <View style={s.outerWrap} pointerEvents="box-none">

      {/* ── Mini bar — only visible ON music pages (hidden elsewhere), not when expanded ── */}
      {!expanded && isOnMusicPage && (
        <Pressable
          style={[s.miniBar, { paddingBottom: Math.max(insets.bottom + 10, 20) }]}
          onPress={expand}
        >
          {/* Title block — left side */}
          <View style={s.miniLeft}>
            <Text style={s.miniTitle} numberOfLines={1}>{title}</Text>
            {artist ? <Text style={s.miniArtist} numberOfLines={1}>{artist}</Text> : null}
          </View>

          {/* Controls — right side: play/pause only */}
          <View style={s.miniControls}>
            <Pressable style={s.miniPlayBtn} onPress={(e) => { e.stopPropagation(); doToggle(); }}>
              <Ionicons name={isPlay ? "pause" : "play"} size={20} color="#fff" />
            </Pressable>
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
          {...dismissPR.panHandlers}
        >
          {/* Header zone (handle + title) */}
          <View
            style={s.dragZoneOuter}
          >
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
              <View style={s.dragHandle} />
              <Text style={s.navLbl}>Now Playing</Text>
            </View>
          </View>

          {/* Artwork */}
          <View style={s.artZone}>
            <View style={s.artBg}>
              <MusicNoteIcon />
            </View>
          </View>

          {/* Flex spacer — pushes title + controls down */}
          <View style={{ flex: 1 }} />

          {/* Track info */}
          <View style={s.trackBlock}>
            <Text style={s.trackTitle} numberOfLines={1}>{title}</Text>
            {artist ? <Text style={s.trackSub} numberOfLines={1}>{artist}</Text> : null}
          </View>

          {/* Scrub bar */}
          <View style={s.scrubSection}>
            <SliderBar value={progress} onChange={doSeek} height={4} thumbSize={14} />
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
            <Feather name="volume" size={14} color="rgba(255,255,255,0.5)" />
            <View style={{ flex: 1 }}>
              <SliderBar value={sysVol} onChange={doSetVolume} height={3} thumbSize={12} color="#fff" />
            </View>
            <Feather name="volume-2" size={14} color="rgba(255,255,255,0.5)" />
          </View>

          <View style={{ height: insets.bottom + 24 }} />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  outerWrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
  },

  // ── Mini bar ─────────────────────────────────────────────────────────────────
  miniBar: {
    position: "absolute", bottom: 10, left: 0, right: 0,
    backgroundColor: ROW,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 18, paddingTop: 12,
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 20,
  },
  miniLeft: {
    flex: 1, marginRight: 12,
  },
  miniTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff",
  },
  miniArtist: {
    fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "Inter_400Regular", marginTop: 2,
  },
  miniControls: {
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  miniPlayBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
  },

  // ── Full screen ───────────────────────────────────────────────────────────
  fullScreen: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: BG, paddingHorizontal: 22,
  },
  dragZoneOuter: { marginHorizontal: -22 },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "center", marginBottom: 10,
  },
  gradHeader: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100, overflow: "hidden",
  },
  navLbl: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center",
    textShadowColor: "rgba(224,49,49,0.45)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },
  artZone: { marginTop: 8, alignItems: "center" },
  artBg: {
    width: SCREEN_W - 56, height: SCREEN_W - 56, borderRadius: 16,
    backgroundColor: "#0a0a0a", borderWidth: 1, borderColor: "#222",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  trackBlock: { marginTop: 0 },
  trackTitle: {
    fontSize: 22, fontWeight: "700", color: "#fff",
    fontFamily: "Inter_700Bold", textAlign: "center",
  },
  trackSub: {
    fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 8,
    fontFamily: "Inter_400Regular", textAlign: "center",
  },
  scrubSection: { marginTop: 16 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  timeText: { fontSize: 10, color: "#fff", letterSpacing: 0.5, fontFamily: "Inter_600SemiBold" },
  ctrlRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 16,
  },
  iconBtn:    { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  bigPlayBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.45,
  },
  volRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 40,
  },
});
