import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

const RED    = "#E03131";
const BG     = "#0b0b0c";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#A0A0A0";

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

const STORAGE_KEY = "mymusic_tracks_v2";
const MUSIC_DIR   = (FileSystem.documentDirectory ?? "") + "music/";

type Track = { id: string; name: string; uri: string };

// ── EQ bar animation ──────────────────────────────────────────────────────────
function EqBar({ index }: { index: number }) {
  const height = useRef(new Animated.Value(MIN_H)).current;
  useEffect(() => {
    const dur = 900 + index * 120;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(height, { toValue: MAX_H * BAR_HEIGHTS[index], duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(height, { toValue: MIN_H, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    const tid = setTimeout(() => anim.start(), BAR_DELAYS[index]);
    return () => { clearTimeout(tid); anim.stop(); };
  }, []);
  return <Animated.View style={[st.eqBar, { height }]} />;
}

// ── Animated collapse when row is removed ─────────────────────────────────────
function CollapseRow({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  const h  = useRef(new Animated.Value(64)).current;
  const op = useRef(new Animated.Value(1)).current;
  const mb = useRef(new Animated.Value(8)).current;

  const collapse = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(op, { toValue: 0, duration: 100, useNativeDriver: false }),
      Animated.timing(h,  { toValue: 0, duration: 240, delay: 60, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(mb, { toValue: 0, duration: 240, delay: 60, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(onRemove);
  }, [onRemove]);

  return (
    <Animated.View style={{ height: h, opacity: op, marginBottom: mb, overflow: "hidden" }}>
      {React.cloneElement(children as React.ReactElement, { onCollapse: collapse })}
    </Animated.View>
  );
}

// ── Swipeable track row ───────────────────────────────────────────────────────
function SwipeTrackRow({
  track, isActive, isPlaying, onPlay, onCollapse,
}: {
  track: Track;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onCollapse?: () => void;
}) {
  const tx  = useRef(new Animated.Value(0)).current;
  const gone = useRef(false);

  const bgOp   = tx.interpolate({ inputRange: [-90, 0], outputRange: [1, 0], extrapolate: "clamp" });
  const iconTx = tx.interpolate({ inputRange: [-90, 0], outputRange: [0, 20], extrapolate: "clamp" });
  const snap   = () => Animated.spring(tx, { toValue: 0, useNativeDriver: false, tension: 160, friction: 14 }).start();

  const del = () => {
    if (gone.current) return;
    gone.current = true;
    onCollapse?.();
  };

  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove:    (_, g) => tx.setValue(Math.min(0, Math.max(-90, g.dx))),
    onPanResponderRelease: (_, g) => g.dx < -55 ? del() : snap(),
    onPanResponderTerminate: snap,
  });

  return (
    <View style={st.rowWrap}>
      {/* Red delete background */}
      <Animated.View style={[StyleSheet.absoluteFill, {
        backgroundColor: RED, opacity: bgOp,
        borderRadius: 14,
        alignItems: "flex-end", justifyContent: "center", paddingRight: 18,
      }]}>
        <Animated.View style={{ transform: [{ translateX: iconTx }] }}>
          <Feather name="trash-2" size={18} color="#fff" />
        </Animated.View>
      </Animated.View>

      {/* Foreground row */}
      <Animated.View
        style={[st.trackRow, isActive && st.trackRowActive, { transform: [{ translateX: tx }] }]}
        {...pan.panHandlers}
      >
        <Pressable
          style={st.trackRowInner}
          onPress={onPlay}
        >
          <View style={[st.trackIcon, isActive && st.trackIconActive]}>
            <Feather
              name={isActive && isPlaying ? "volume-2" : "music"}
              size={18}
              color={RED}
            />
          </View>
          <Text
            style={[st.trackName, isActive && st.trackNamePlaying]}
            numberOfLines={2}
          >
            {track.name}
          </Text>
          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.15)" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MusicMyMusicScreen() {
  const insets   = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  const [tracks,     setTracks]     = useState<Track[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [posMs,      setPosMs]      = useState(0);
  const [durMs,      setDurMs]      = useState(0);

  const soundRef        = useRef<Audio.Sound | null>(null);
  const tracksRef       = useRef<Track[]>([]);
  const currentIdxRef   = useRef<number | null>(null);
  const progressBarWidth = useRef(0);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v) setTracks(JSON.parse(v));
    });
  }, []));

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  const saveTracks = (list: Track[]) => {
    setTracks(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      await FileSystem.makeDirectoryAsync(MUSIC_DIR, { intermediates: true });

      const newTracks: Track[] = [];
      for (const asset of result.assets) {
        const fileName = asset.name ?? `track_${Date.now()}.mp3`;
        const destUri  = MUSIC_DIR + fileName;
        try {
          const info = await FileSystem.getInfoAsync(destUri);
          if (!info.exists) {
            await FileSystem.copyAsync({ from: asset.uri, to: destUri });
          }
          const displayName = fileName
            .replace(/\.[^.]+$/, "")
            .replace(/[_-]+/g, " ")
            .trim();
          newTracks.push({ id: destUri, name: displayName, uri: destUri });
        } catch (err) {
          console.warn("copy failed:", fileName, err);
        }
      }

      if (newTracks.length) {
        const cur    = tracksRef.current;
        const merged = [...cur, ...newTracks.filter(t => !cur.find(x => x.id === t.id))];
        saveTracks(merged);
      }
    } catch (err) {
      console.error("picker error:", err);
    }
  };

  const stopAndUnload = async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  };

  const playTrack = async (idx: number) => {
    const list = tracksRef.current;
    if (idx < 0 || idx >= list.length) return;
    const track = list[idx];

    await stopAndUnload();
    setCurrentIdx(idx);
    setIsPlaying(false);
    setPosMs(0);
    setDurMs(0);

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        (status) => {
          if (!status.isLoaded) return;
          setPosMs(status.positionMillis);
          setDurMs(status.durationMillis ?? 0);
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            const cur  = currentIdxRef.current ?? 0;
            const next = (cur + 1) % tracksRef.current.length;
            setTimeout(() => playTrack(next), 400);
          }
        }
      );
      soundRef.current = sound;
    } catch (err) {
      console.error("play error:", err);
    }
  };

  const togglePlay = async () => {
    if (!soundRef.current) {
      const idx = currentIdxRef.current;
      if (idx !== null) await playTrack(idx);
      else if (tracksRef.current.length > 0) await playTrack(0);
      return;
    }
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const skipBack = async () => {
    if (posMs > 3000 && soundRef.current) {
      await soundRef.current.setPositionAsync(0);
    } else {
      const list = tracksRef.current;
      const cur  = currentIdxRef.current;
      const idx  = cur === null ? 0 : (cur - 1 + list.length) % list.length;
      await playTrack(idx);
    }
  };

  const skipForward = async () => {
    const list = tracksRef.current;
    const cur  = currentIdxRef.current;
    const idx  = cur === null ? 0 : (cur + 1) % list.length;
    await playTrack(idx);
  };

  const deleteTrack = async (idx: number) => {
    const track = tracksRef.current[idx];
    if (currentIdxRef.current === idx) {
      await stopAndUnload();
      setCurrentIdx(null);
      setIsPlaying(false);
      setPosMs(0);
      setDurMs(0);
    } else if (currentIdxRef.current !== null && currentIdxRef.current > idx) {
      setCurrentIdx(currentIdxRef.current - 1);
    }
    try { await FileSystem.deleteAsync(track.uri, { idempotent: true }); } catch {}
    const updated = tracksRef.current.filter((_, i) => i !== idx);
    saveTracks(updated);
  };

  const handleSeek = async (e: any) => {
    const x    = e.nativeEvent.locationX;
    const barW = progressBarWidth.current;
    if (!barW || !durMs || !soundRef.current) return;
    const ratio  = Math.max(0, Math.min(1, x / barW));
    const target = Math.floor(ratio * durMs);
    setPosMs(target);
    try { await soundRef.current.setPositionAsync(target); } catch {}
  };

  const progress     = durMs > 0 ? posMs / durMs : 0;
  const currentTrack = currentIdx !== null ? tracks[currentIdx] : null;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={[st.inner, isTablet && st.innerTablet]}>

        {/* Header — long press EQ to add tracks */}
        <View style={st.headerArea}>
          <Pressable
            style={st.eqWrap}
            onPress={() => router.back()}
            onLongPress={pickFiles}
            delayLongPress={400}
          >
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <EqBar key={i} index={i} />
            ))}
          </Pressable>
          <Text style={st.pageTitle}>My Music</Text>
        </View>

        {/* Track list */}
        {tracks.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="music" size={44} color="rgba(255,255,255,0.1)" />
            <Text style={st.emptyTitle}>No tracks yet</Text>
            <Text style={st.emptySubtitle}>
              Long press the equaliser above to add music from your phone
            </Text>
            <Pressable style={st.emptyBtn} onPress={pickFiles}>
              <Feather name="plus" size={15} color="#fff" />
              <Text style={st.emptyBtnText}>Add Music</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={st.list}
            contentContainerStyle={st.listContent}
            showsVerticalScrollIndicator={false}
          >
            {tracks.map((track, i) => (
              <CollapseRow key={track.id} onRemove={() => deleteTrack(i)}>
                <SwipeTrackRow
                  track={track}
                  isActive={i === currentIdx}
                  isPlaying={isPlaying}
                  onPlay={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    playTrack(i);
                  }}
                />
              </CollapseRow>
            ))}
          </ScrollView>
        )}

        {/* Player bar */}
        <View style={[st.player, { paddingBottom: insets.bottom + 8 }]}>
          <View style={st.playerTrack}>
            <View style={st.playerArt}>
              <Feather name="music" size={22} color={RED} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.playerName} numberOfLines={1}>
                {currentTrack ? currentTrack.name : "No track selected"}
              </Text>
              {durMs > 0 && (
                <Text style={st.playerTime}>{fmtMs(posMs)} / {fmtMs(durMs)}</Text>
              )}
            </View>
          </View>

          {/* Scrubable progress bar */}
          <View
            style={st.progressHitArea}
            onLayout={e => { progressBarWidth.current = e.nativeEvent.layout.width; }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleSeek}
            onResponderMove={handleSeek}
            onResponderRelease={handleSeek}
          >
            <View style={st.progressTrack}>
              <View style={[st.progressFill, { width: `${(progress * 100).toFixed(1)}%` }]} />
            </View>
          </View>

          <View style={st.controls}>
            <Pressable style={st.ctrlBtn} onPress={skipBack}>
              <Feather name="skip-back" size={26} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Pressable style={st.playBtn} onPress={togglePlay}>
              <Feather name={isPlaying ? "pause" : "play"} size={24} color="#fff" />
            </Pressable>
            <Pressable style={st.ctrlBtn} onPress={skipForward}>
              <Feather name="skip-forward" size={26} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        </View>

      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 900, alignSelf: "center", width: "100%" },

  headerArea: { backgroundColor: BG, paddingTop: 12, paddingBottom: 4, alignItems: "center" },
  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 62, paddingBottom: 4,
  },
  eqBar:     { width: 5, borderRadius: 3, backgroundColor: RED },
  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontFamily: "Inter_600SemiBold",
    paddingTop: 8, paddingBottom: 10,
  },

  list:        { flex: 1 },
  listContent: { padding: 16, paddingBottom: 12 },

  rowWrap: { position: "relative" },

  trackRow: {
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER, borderRadius: 14,
  },
  trackRowActive: { borderColor: "rgba(224,49,49,0.35)" },

  trackRowInner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 10,
  },

  trackIcon: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  trackIconActive:  { borderColor: "rgba(224,49,49,0.3)" },
  trackName:        { flex: 1, fontSize: 14, color: "#fff", fontFamily: "Inter_500Medium", lineHeight: 19 },
  trackNamePlaying: { color: RED },

  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40,
  },
  emptyTitle:    { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { color: GREY, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 8, backgroundColor: RED, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10, shadowOpacity: 0.35, elevation: 4,
  },
  emptyBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  player: {
    backgroundColor: ROW, borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 20,
  },
  playerTrack: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  playerArt: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  playerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  playerTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: GREY, marginTop: 3 },

  progressHitArea: { height: 24, justifyContent: "center", marginBottom: 26 },
  progressTrack: {
    height: 4, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: RED, borderRadius: 2 },

  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 36, marginBottom: 10 },
  ctrlBtn:  { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16, shadowOpacity: 0.45, elevation: 4,
  },
});
