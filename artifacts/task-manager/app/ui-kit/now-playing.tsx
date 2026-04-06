import React, { useState, useEffect } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"
        fill={filled ? RED : "none"}
        stroke={filled ? "none" : "#555"}
        strokeWidth={filled ? 0 : 1.5}
      />
    </Svg>
  );
}

function ShuffleIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M16 3l4 4-4 4M20 7H8c-2.8 0-5 2.2-5 5v.5M8 21l-4-4 4-4M4 17h12c2.8 0 5-2.2 5-5v-.5"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

function RepeatIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

function PrevIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Path d="M19 5L9 12L19 19" fill="#aaa" />
      <Rect x="5" y="5" width="3" height="14" rx="1.5" fill="#aaa" />
    </Svg>
  );
}

function NextIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Path d="M5 5L15 12L5 19" fill="#aaa" />
      <Rect x="16" y="5" width="3" height="14" rx="1.5" fill="#aaa" />
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
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ── Top nav ── */}
      <View style={s.topnav}>
        <Pressable style={s.iconBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color="#555" />
        </Pressable>
        <Text style={s.navLbl}>NOW PLAYING</Text>
        <Pressable style={s.iconBtn}>
          <Feather name="more-horizontal" size={18} color="#555" />
        </Pressable>
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
        <Text style={s.trackTitle} numberOfLines={1}>{MOCK.title}</Text>
        <Text style={s.trackSub} numberOfLines={1}>{MOCK.artist} — {MOCK.album}</Text>
        <View style={s.trackRow}>
          <View style={s.bpmBadge}>
            <View style={s.bpmDot} />
            <Text style={s.bpmLbl}>{MOCK.bpm} BPM</Text>
          </View>
          <Pressable onPress={() => setLiked(v => !v)} hitSlop={12}>
            <HeartIcon filled={liked} />
          </Pressable>
        </View>
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
        <Pressable style={s.iconBtn36} onPress={() => setShuffle(v => !v)}>
          <ShuffleIcon color={shuffle ? RED : "#3a3a3a"} />
        </Pressable>
        <Pressable style={s.iconBtn44}>
          <PrevIcon />
        </Pressable>
        <Pressable style={s.playCircle} onPress={() => setPlaying(v => !v)}>
          <Feather
            name={playing ? "pause" : "play"}
            size={24}
            color="#fff"
            style={playing ? undefined : { marginLeft: 3 }}
          />
        </Pressable>
        <Pressable style={s.iconBtn44}>
          <NextIcon />
        </Pressable>
        <Pressable style={s.iconBtn36} onPress={() => setRepeat(v => !v)}>
          <RepeatIcon color={repeat ? RED : "#3a3a3a"} />
        </Pressable>
      </View>

      {/* ── Volume ── */}
      <View style={s.volRow}>
        <VolLow />
        <View style={s.volTrack}>
          <View style={s.volFill} />
        </View>
        <VolHigh />
      </View>

      {/* ── Up next ── */}
      <View style={s.queueBlock}>
        <Text style={s.queueLbl}>UP NEXT</Text>
        {QUEUE.map(item => (
          <View key={item.n} style={s.qRow}>
            <Text style={s.qNum}>{item.n}</Text>
            <View style={s.qInfo}>
              <Text style={s.qTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={s.qArtist}>{item.artist}</Text>
            </View>
            <Text style={s.qDur}>{item.dur}</Text>
          </View>
        ))}
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
  topnav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
  },
  navLbl: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2.5,
    color: "#444",
    fontFamily: "Inter_600SemiBold",
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  // Art
  artZone: { marginTop: 14 },
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
    maxHeight: 200,
  },
  artBgTablet: { maxHeight: 280 },
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
  trackBlock: { marginTop: 16 },
  trackTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 26,
    fontFamily: "Inter_700Bold",
  },
  trackSub: {
    fontSize: 13,
    color: "#555",
    marginTop: 3,
    fontWeight: "300",
    fontFamily: "Inter_400Regular",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  bpmBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  bpmDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: RED },
  bpmLbl:   { fontSize: 10, color: "#444", letterSpacing: 1, fontFamily: "Inter_600SemiBold" },

  // Scrub
  scrubBlock: { marginTop: 14 },
  scrubTrack: {
    width: "100%",
    height: 2,
    backgroundColor: DIM,
    borderRadius: 1,
  },
  scrubFill: {
    height: "100%",
    backgroundColor: RED,
    borderRadius: 1,
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
    color: "#3a3a3a",
    letterSpacing: 0.5,
    fontFamily: "Inter_600SemiBold",
  },

  // Controls
  ctrlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
  },
  iconBtn36: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  iconBtn44: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  playCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },

  // Volume
  volRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
  },
  volTrack: {
    flex: 1,
    height: 2,
    backgroundColor: DIM,
    borderRadius: 1,
  },
  volFill: {
    height: "100%",
    width: "68%",
    backgroundColor: MID,
    borderRadius: 1,
  },

  // Queue
  queueBlock: { marginTop: 16, flex: 1 },
  queueLbl: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#2a2a2a",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  qRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#141414",
    marginBottom: 4,
  },
  qNum: {
    fontSize: 11,
    color: "#2e2e2e",
    width: 14,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
  },
  qInfo: { flex: 1, minWidth: 0 },
  qTitle: {
    fontSize: 11,
    color: "#777",
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  qArtist: {
    fontSize: 10,
    color: "#333",
    marginTop: 1,
    fontFamily: "Inter_400Regular",
  },
  qDur: {
    fontSize: 10,
    color: "#2e2e2e",
    fontFamily: "Inter_600SemiBold",
  },
});
