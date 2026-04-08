import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
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
  // null = native module not present (Expo Go / pre-build) — don't show slider
  const [sysVol, setSysVol] = useState<number | null>(_VolumeManager ? 1 : null);
  // Drive the slider directly from the native listener — no React re-render lag
  const volAnim = useRef(new Animated.Value(_VolumeManager ? 1 : 0)).current;

  useEffect(() => {
    if (!_VolumeManager) return;
    // Read current system volume
    _VolumeManager.getVolume().then((v: any) => {
      const val = typeof v === "object" ? (v.volume ?? v) : v;
      const clamped = Math.max(0, Math.min(1, Number(val)));
      setSysVol(clamped);
      volAnim.setValue(clamped);
    }).catch(() => {});
    // Keep in sync with hardware volume buttons — update Animated.Value directly
    // so the slider moves immediately without waiting for a React render cycle
    const sub = _VolumeManager.addVolumeListener((v: any) => {
      const val = typeof v === "object" ? (v.volume ?? v) : v;
      const clamped = Math.max(0, Math.min(1, Number(val)));
      setSysVol(clamped);
      volAnim.setValue(clamped); // direct — no setState needed for the visual
    });
    return () => { try { sub?.remove?.(); } catch {} };
  }, []);

  const setSystemVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setSysVol(clamped);
    volAnim.setValue(clamped);
    try { _VolumeManager?.setVolume(clamped, { showUI: false }); } catch {}
  }, []);

  return { sysVol, setSystemVolume, volAnim };
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
  externalAnim,
  liveUpdate = false,
}: {
  value: number;
  onChange: (ratio: number) => void;
  height?: number;
  thumbSize?: number;
  color?: string;
  externalAnim?: Animated.Value; // when provided, drives the fill directly (e.g. volume)
  liveUpdate?: boolean;           // call onChange on every move, not just release
}) {
  const barRef     = useRef<View>(null);
  const barLeft    = useRef(0);
  const barWidth   = useRef(0);
  const internalAnim = useRef(new Animated.Value(value)).current;
  // Use external Animated.Value if provided (so hardware volume buttons drive it directly)
  const anim       = externalAnim ?? internalAnim;
  // Keep anim accessible in PanResponder callbacks without stale closure
  const animRef    = useRef(anim);
  animRef.current  = anim;
  const thumbScale = useRef(new Animated.Value(1)).current;
  const dragging   = useRef(false);

  const thumbIn  = () => Animated.spring(thumbScale, { toValue: 1.7, useNativeDriver: true, damping: 14, stiffness: 280 }).start();
  const thumbOut = () => Animated.spring(thumbScale, { toValue: 1,   useNativeDriver: true, damping: 14, stiffness: 280 }).start();

  // Only sync from props when no external anim is driving the value
  useEffect(() => {
    if (!externalAnim && !dragging.current) internalAnim.setValue(value);
  }, [value, externalAnim]);

  const fillWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp" });

  const measure = () => {
    barRef.current?.measureInWindow((x, _y, w) => {
      barLeft.current  = x;
      barWidth.current = w;
    });
  };

  // Keep liveUpdate accessible inside PanResponder without recreating it
  const liveUpdateRef = useRef(liveUpdate);
  liveUpdateRef.current = liveUpdate;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      dragging.current = true;
      thumbIn();
      if (!barWidth.current) return;
      const ratio = Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current));
      animRef.current.setValue(ratio);
      if (liveUpdateRef.current) onChangeRef.current(ratio);
    },
    onPanResponderMove: (e) => {
      if (!barWidth.current) return;
      const ratio = Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current));
      animRef.current.setValue(ratio);
      // liveUpdate: apply the change in real time (used by volume slider)
      if (liveUpdateRef.current) onChangeRef.current(ratio);
    },
    onPanResponderRelease: (e) => {
      dragging.current = false;
      thumbOut();
      if (!barWidth.current) return;
      const ratio = Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current));
      animRef.current.setValue(ratio);
      onChangeRef.current(ratio);
    },
    onPanResponderTerminate: () => { dragging.current = false; thumbOut(); },
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
          <Animated.View style={{
            position: "absolute", right: -thumbSize / 2, top: -(thumbSize - height) / 2,
            width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: color,
            transform: [{ scale: thumbScale }],
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
  const screenH      = Dimensions.get("window").height;
  // slideAnim: expand spring + non-gesture collapse timing (stays at 0 while expanded)
  const slideAnim    = useRef(new Animated.Value(screenH)).current;
  // panDrag: native-thread gesture tracking via PanGestureHandler + Animated.event
  // Both are useNativeDriver — Animated.add works; no JS involvement per frame
  const panDrag      = useRef(new Animated.Value(0)).current;
  const miniBarAlpha = useRef(new Animated.Value(1)).current;
  const dismissing   = useRef(false);

  // Clamp panDrag ≥ 0 so upward swipes don't push the sheet above the screen
  const panDragClamped = panDrag.interpolate({
    inputRange: [-screenH, 0, screenH],
    outputRange: [0, 0, screenH],
    extrapolate: "clamp",
  });

  const expand = useCallback(() => {
    dismissing.current = false;
    panDrag.setValue(0);
    // Reset slideAnim to screenH BEFORE setExpanded so the native view mounts
    // at the correct off-screen position and the spring has somewhere to animate from
    slideAnim.setValue(screenH);
    miniBarAlpha.setValue(0);
    setExpanded(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 220 }).start();
  }, [slideAnim, panDrag, miniBarAlpha, screenH]);

  // collapse() — called from non-gesture triggers only (panDrag is 0 here)
  const collapse = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    miniBarAlpha.setValue(1);
    Animated.timing(slideAnim, {
      toValue: screenH,
      duration: 340,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => { setExpanded(false); });
  }, [slideAnim, screenH, miniBarAlpha]);

  const collapseRef = useRef(collapse);
  useEffect(() => { collapseRef.current = collapse; }, [collapse]);

  // RNGH PanGestureHandler: translationY is a true native event → useNativeDriver: true works
  const panGestureRef = useRef<any>(null);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: panDrag } }],
    { useNativeDriver: true },
  );

  const onHandlerStateChange = useCallback((e: any) => {
    const { state, translationY, velocityY } = e.nativeEvent;

    if (state === State.ACTIVE) {
      // Gesture just crossed the activation threshold — translationY is already non-zero.
      // Zero-base it so the view starts moving from exactly where it currently sits.
      panDrag.setOffset(-translationY);
      panDrag.setValue(translationY);
      // From here: displayed = translationY + (-initialTranslationY) = 0, then grows smoothly
      return;
    }

    if (state === State.END || state === State.FAILED || state === State.CANCELLED) {
      panDrag.flattenOffset();
      const delta = Math.max(0, (panDrag as any).__getValue() as number);
      if (delta > 80 || velocityY > 800) {
        dismissing.current = true;
        miniBarAlpha.setValue(1);
        Animated.timing(panDrag, {
          toValue: screenH,
          duration: 340,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          panDrag.setValue(0);
          slideAnim.setValue(screenH); // reset so next expand() has a valid start position
          setExpanded(false);
        });
      } else {
        Animated.spring(panDrag, { toValue: 0, useNativeDriver: true }).start();
      }
    }
  }, [panDrag, slideAnim, miniBarAlpha, screenH]);

  // ── System volume (hardware scale) ──────────────────────────────────────
  const { sysVol, setSystemVolume, volAnim } = useSystemVolume();

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

      {/* ── Mini bar — always in tree when on music page; opacity controlled by
               miniBarAlpha (Animated.Value) so it appears synchronously on collapse ── */}
      {isOnMusicPage && (
        <Animated.View
          style={[s.miniBar, { paddingBottom: Math.max(insets.bottom + 10, 20), opacity: miniBarAlpha }]}
          pointerEvents={expanded ? "none" : "auto"}
        >
          <Pressable style={s.miniBarPressable} onPress={expand}>
            {/* Icon — matches mymusic track rows: Feather "music" in a square box */}
            <View style={s.miniIcon}>
              <Feather name="music" size={16} color={RED} />
            </View>

            {/* Title + artist */}
            <View style={s.miniLeft}>
              <Text style={s.miniTitle} numberOfLines={1}>{title}</Text>
              {artist ? <Text style={s.miniArtist} numberOfLines={1}>{artist}</Text> : null}
            </View>

            {/* Play/pause */}
            <Pressable
              style={({ pressed }) => [s.miniPlayBtn, { transform: [{ scale: pressed ? 0.91 : 1 }] }]}
              onPress={(e) => { e.stopPropagation(); doToggle(); }}
            >
              <Ionicons name={isPlay ? "pause" : "play"} size={20} color="#fff" />
            </Pressable>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Full-screen now playing ── */}
      {expanded && (
        <PanGestureHandler
          ref={panGestureRef}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          activeOffsetY={10}
          failOffsetX={[-25, 25]}
        >
        <Animated.View
          style={[
            s.fullScreen,
            { transform: [{ translateY: Animated.add(slideAnim, panDragClamped) }] },
          ]}
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
            <Pressable
              style={({ pressed }) => [s.iconBtn, { opacity: pressed ? 0.45 : 1 }]}
              onPress={() => setShuffle(v => !v)}
            >
              <Ionicons name="shuffle" size={22} color={shuffle ? RED : "#3a3a3a"} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.iconBtn, { opacity: pressed ? 0.45 : 1 }]}
              onPress={doSkipBack}
            >
              <Ionicons name="play-skip-back" size={30} color="#fff" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.bigPlayBtn, { transform: [{ scale: pressed ? 0.91 : 1 }] }]}
              onPress={doToggle}
            >
              <Ionicons name={isPlay ? "pause" : "play"} size={30} color="#fff" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.iconBtn, { opacity: pressed ? 0.45 : 1 }]}
              onPress={doSkipFwd}
            >
              <Ionicons name="play-skip-forward" size={30} color="#fff" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.iconBtn, { opacity: pressed ? 0.45 : 1 }]}
              onPress={() => setRepeat(v => !v)}
            >
              <Ionicons name="repeat" size={22} color={repeat ? RED : "#3a3a3a"} />
            </Pressable>
          </View>

          {/* Volume slider — only rendered when native module is present (EAS build) */}
          {sysVol !== null && (
            <View style={s.volRow}>
              <Feather name="volume" size={14} color="rgba(255,255,255,0.5)" />
              <View style={{ flex: 1 }}>
                <SliderBar
                  value={sysVol}
                  onChange={doSetVolume}
                  height={3}
                  thumbSize={12}
                  color="#fff"
                  externalAnim={volAnim}
                  liveUpdate
                />
              </View>
              <Feather name="volume-2" size={14} color="rgba(255,255,255,0.5)" />
            </View>
          )}

          <View style={{ height: insets.bottom + 24 }} />
        </Animated.View>
        </PanGestureHandler>
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
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: ROW,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 20,
  },
  miniBarPressable: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingTop: 12, gap: 12,
  },
  miniIcon: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: ROW,
    alignItems: "center", justifyContent: "center",
  },
  miniLeft: {
    flex: 1,
  },
  miniTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff",
  },
  miniArtist: {
    fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "Inter_400Regular", marginTop: 2,
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
