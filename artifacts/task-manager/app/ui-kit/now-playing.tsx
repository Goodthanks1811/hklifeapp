import React, { useState, useEffect } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

const RED  = "#E03131";
const BG   = "#0b0b0c";
const DIM  = "#1e1e1e";
const MID  = "#2e2e2e";

const MOCK = {
  title:    "Nothing Else Matters",
  artist:   "Metallica",
  album:    "Arab Desert Epic Remix",
  bpm:      "128",
  duration: 222,
  elapsed:  84,
};

const QUEUE = [
  { n: "2", title: "In Da Club Remix 2022",     artist: "2Pac",       dur: "4:12" },
  { n: "3", title: "Shape of You (Reggae Flip)", artist: "Ed Sheeran", dur: "3:55" },
  { n: "4", title: "Heartless Reggae Dub Cover", artist: "Kanye West", dur: "3:28" },
];

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function MusicNoteIcon() {
  return (
    <Svg width={110} height={120} viewBox="0 0 110 120">
      <Defs>
        <LinearGradient id="ng" x1="20" y1="10" x2="90" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#ff7070" />
          <Stop offset="35%"  stopColor={RED} />
          <Stop offset="100%" stopColor="#5a0000" />
        </LinearGradient>
        <LinearGradient id="ng2" x1="20" y1="10" x2="90" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor="#ff9090" />
          <Stop offset="40%"  stopColor="#cc1010" />
          <Stop offset="100%" stopColor="#3a0000" />
        </LinearGradient>
      </Defs>
      <Rect x="52" y="12" width="10" height="72" rx="5" fill="url(#ng)" />
      <Path
        d="M62 12 C85 18, 88 30, 88 40 C88 52, 76 56, 62 52 C72 48, 80 42, 78 32 C76 22, 62 20, 62 20 Z"
        fill="url(#ng2)"
      />
      <Ellipse cx="42" cy="84" rx="18" ry="13" rotation="-15" originX="42" originY="84" fill="url(#ng)" />
      <Ellipse cx="38" cy="79" rx="9"  ry="5"  rotation="-15" originX="38" originY="79" fill="rgba(255,160,160,0.18)" />
      <Rect x="54" y="14" width="4" height="20" rx="2" fill="rgba(255,180,180,0.15)" />
    </Svg>
  );
}

function SavedIcon({ saved }: { saved: boolean }) {
  if (!saved) {
    return (
      <Svg width={28} height={28} viewBox="0 0 28 28">
        <Ellipse cx="14" cy="14" rx="13" ry="13" stroke="#444" strokeWidth={1.5} fill="none" />
        <Path d="M7.5 14.5L11.5 18.5L20.5 9" stroke="#555" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Ellipse cx="14" cy="14" rx="14" ry="14" fill={RED} />
      <Path d="M7.5 14.5L11.5 18.5L20.5 9" stroke="#000" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function ShuffleIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M16 3l4 4-4 4M20 7H8c-2.8 0-5 2.2-5 5v.5M8 21l-4-4 4-4M4 17h12c2.8 0 5-2.2 5-5v-.5"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

function RepeatIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
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

function VolLow() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M11 5L6 9H2v6h4l5 4V5z" fill={MID} />
    </Svg>
  );
}

function VolHigh() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M11 5L6 9H2v6h4l5 4V5z" fill={MID} />
      <Path d="M15 9a5 5 0 010 6M19 5a11 11 0 010 14" stroke={MID} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export default function NowPlayingScreen() {
  const insets  = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  const [playing,  setPlaying]  = useState(false);
  const [liked,    setLiked]    = useState(true);
  const [shuffle,  setShuffle]  = useState(true);
  const [repeat,   setRepeat]   = useState(false);
  const [secs,     setSecs]     = useState(MOCK.elapsed);
  const total = MOCK.duration;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSecs(s => (s + 1) % total), 1000);
    return () => clearInterval(id);
  }, [playing]);

  const pct = Math.round((secs / total) * 100);

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 32 }]}>
      {/* ── Gradient header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8, paddingBottom: isTablet ? 58 : 36 }]}>
        <ExpoLinearGradient
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
        <View style={s.gradNav} />
        <Text style={s.navLbl}>Now Playing</Text>
      </View>

      {/* ── Album art ── */}
      <View style={s.artZone}>
        <View style={[s.artBg, isTablet && s.artBgTablet]}>
          <View style={s.artGloss} />
          <MusicNoteIcon />
        </View>
      </View>

      {/* ── Track info ── */}
      <View style={s.trackBlock}>
        <View style={s.titleRow}>
          <Text style={[s.trackTitle, { flex: 1 }]} numberOfLines={1}>{MOCK.title}</Text>
          <Pressable onPress={() => setLiked(v => !v)} hitSlop={12}>
            <SavedIcon saved={liked} />
          </Pressable>
        </View>
        <Text style={s.trackSub} numberOfLines={1}>{MOCK.artist} — {MOCK.album}</Text>
      </View>

      {/* ── Scrub bar ── */}
      <View style={s.scrubBlock}>
        <View style={s.scrubTrack}>
          <View style={[s.scrubFill, { width: `${pct}%` as any }]}>
            <View style={s.scrubDot} />
          </View>
        </View>
        <View style={s.scrubTimes}>
          <Text style={s.timeText}>{fmt(secs)}</Text>
          <Text style={s.timeText}>{fmt(total)}</Text>
        </View>
      </View>

      {/* ── Controls ── */}
      <View style={s.ctrlRow}>
        <Pressable style={s.iconBtn44} onPress={() => setShuffle(v => !v)}>
          <ShuffleIcon color={shuffle ? RED : "#3a3a3a"} />
        </Pressable>
        <Pressable style={s.iconBtn44}>
          <PrevIcon />
        </Pressable>
        <Pressable style={s.playCircle} onPress={() => setPlaying(v => !v)}>
          {playing ? (
            <Svg width={26} height={26} viewBox="0 0 26 26">
              <Rect x="5" y="4" width="5" height="18" rx="2" fill="#fff" />
              <Rect x="16" y="4" width="5" height="18" rx="2" fill="#fff" />
            </Svg>
          ) : (
            <Svg width={30} height={30} viewBox="0 0 26 26">
              <Path d="M8 4L22 13L8 22Z" fill="#fff" />
            </Svg>
          )}
        </Pressable>
        <Pressable style={s.iconBtn44}>
          <NextIcon />
        </Pressable>
        <Pressable style={s.iconBtn44} onPress={() => setRepeat(v => !v)}>
          <RepeatIcon color={repeat ? RED : "#3a3a3a"} />
        </Pressable>
      </View>

      {/* ── Volume ── */}
      <View style={s.volRow}>
        <VolLow />
        <View style={s.volTrack}>
          <View style={s.volFill}>
            <View style={s.volThumb} />
          </View>
        </View>
        <VolHigh />
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 22,
  },
  header: {
    backgroundColor: "#0f0f0f",
    marginHorizontal: -22,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  gradNav: {
    height: 36,
    marginBottom: 14,
  },
  navLbl: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
    textShadowColor: "rgba(224,49,49,0.45)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },

  // Art
  artZone: { marginTop: 2 },
  artBg: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    alignSelf: "center",
  },
  artBgTablet: {},
  artGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },

  // Track
  trackBlock: { marginTop: 24 },
  trackTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 26,
    fontFamily: "Inter_700Bold",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  trackSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginTop: 10,
    fontWeight: "300",
    fontFamily: "Inter_400Regular",
  },

  // Scrub
  scrubBlock: { marginTop: 32 },
  scrubTrack: {
    width: "100%",
    height: 4,
    backgroundColor: DIM,
    borderRadius: 2,
  },
  scrubFill: {
    height: "100%",
    backgroundColor: RED,
    borderRadius: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  scrubDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: RED,
    position: "absolute",
    right: -6,
  },
  scrubTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  timeText: {
    fontSize: 10,
    color: "#fff",
    letterSpacing: 0.5,
    fontFamily: "Inter_600SemiBold",
  },

  // Controls
  ctrlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
  },
  iconBtn36: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  iconBtn44: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  playCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },

  // Volume
  volRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 44,
  },
  volTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "#3a3a3a",
    borderRadius: 2,
    justifyContent: "center",
  },
  volFill: {
    height: "100%",
    width: "68%",
    backgroundColor: "#fff",
    borderRadius: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  volThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    position: "absolute",
    right: -6,
  },

});
