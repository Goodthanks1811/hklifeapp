import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
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
      ])
    );
    const tid = setTimeout(() => anim.start(), BAR_DELAYS[index]);
    return () => { clearTimeout(tid); anim.stop(); };
  }, []);
  return <Animated.View style={[st.eqBar, { height }]} />;
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

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
        const fileName    = asset.name ?? `track_${Date.now()}.mp3`;
        const destUri     = MUSIC_DIR + fileName;
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
        const merged = [
          ...cur,
          ...newTracks.filter(t => !cur.find(x => x.id === t.id)),
        ];
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    const x     = e.nativeEvent.locationX;
    const barW  = progressBarWidth.current;
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

        {/* Header - long press EQ to add tracks */}
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

        {/* Track List */}
        {tracks.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="music" size={44} color="rgba(255,255,255,0.1)" />
            <Text style={st.emptyTitle}>No tracks yet</Text>
            <Text style={st.emptySubtitle}>Long press the equaliser above to add music from your phone</Text>
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
              <Pressable
                key={track.id}
                style={({ pressed }) => [
                  st.trackRow,
                  pressed && st.trackPressed,
                  i === currentIdx && st.trackRowActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  playTrack(i);
                }}
                onLongPress={() => deleteTrack(i)}
                delayLongPress={600}
              >
                <View style={[st.trackIcon, i === currentIdx && st.trackIconActive]}>
                  <Feather
                    name={i === currentIdx && isPlaying ? "volume-2" : "music"}
                    size={18}
                    color={RED}
                  />
                </View>
                <Text
                  style={[st.trackName, i === currentIdx && st.trackNamePlaying]}
                  numberOfLines={2}
                >
                  {track.name}
                </Text>
                <Pressable hitSlop={10} onPress={() => deleteTrack(i)}>
                  <Feather name="x" size={14} color="rgba(255,255,255,0.2)" />
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Player Bar - matches home screen style */}
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
                <Text style={st.playerTime}>
                  {fmtMs(posMs)} / {fmtMs(durMs)}
                </Text>
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
  listContent: { padding: 16, gap: 8, paddingBottom: 12 },

  trackRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 10,
  },
  trackRowActive: { borderColor: "rgba(224,49,49,0.35)" },
  trackPressed:   { opacity: 0.7 },

  trackIcon: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  trackIconActive:  { borderColor: "rgba(224,49,49,0.3)" },
  trackName:        { flex: 1, fontSize: 13.5, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium", lineHeight: 19 },
  trackNamePlaying: { color: "#fff" },

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

  progressHitArea: {
    height: 24, justifyContent: "center", marginBottom: 26,
  },
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
