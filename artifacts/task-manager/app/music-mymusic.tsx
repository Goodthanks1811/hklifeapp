import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import { Swipeable } from "react-native-gesture-handler";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useMusicPlayer, MusicTrack } from "@/context/MusicPlayerContext";

const RED    = "#E03131";
const BG     = "#0b0b0c";
const ROW_BG = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#888";

const ITEM_H      = 52;
const PLAYER_H    = 280;

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H       = 42;
const MIN_H       = 5;

const STORAGE_KEY = "mymusic_tracks_v2";
const MUSIC_DIR   = (FileSystem.documentDirectory ?? "") + "music/";

// ── EQ bar ────────────────────────────────────────────────────────────────────
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

// ── Swipeable track row — mirrors Life Admin exactly ──────────────────────────
function TrackRow({
  track, isActive, isPlaying, onPlay, onDelete,
}: {
  track: MusicTrack; isActive: boolean; isPlaying: boolean;
  onPlay: () => void; onDelete: () => void;
}) {
  const swipeRef    = useRef<Swipeable>(null);
  const revealedRef = useRef(false);
  const deletingRef = useRef(false);
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const rowHeight   = useRef(new Animated.Value(ITEM_H)).current;
  const rowMargin   = useRef(new Animated.Value(8)).current;

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeRef.current?.close();
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(rowHeight,   { toValue: 0, duration: 260, delay: 40, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(rowMargin,   { toValue: 0, duration: 260, delay: 40, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(() => onDelete());
  }, [onDelete]);

  const renderRightActions = useCallback(() => (
    <Pressable style={st.deleteAction} onPress={triggerDelete}>
      <Feather name="trash-2" size={16} color="#fff" />
      <Text style={st.deletePillTx}>Delete</Text>
    </Pressable>
  ), [triggerDelete]);

  return (
    <Animated.View style={{ height: rowHeight, marginBottom: rowMargin, opacity: opacityAnim }}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        rightThreshold={40}
        friction={3}
        onSwipeableOpen={() => { revealedRef.current = true; }}
        onSwipeableClose={() => { revealedRef.current = false; }}
        containerStyle={{ borderRadius: 14, overflow: "hidden" }}
      >
        {/* Explicit height — same rule as Life Admin's rowWrap */}
        <Pressable
          style={[st.row, isActive && st.rowActive]}
          onPress={() => revealedRef.current ? swipeRef.current?.close() : onPlay()}
        >
          <View style={[st.rowIcon, isActive && st.rowIconActive]}>
            <Feather name={isActive && isPlaying ? "volume-2" : "music"} size={16} color={RED} />
          </View>
          <Text style={[st.rowName, isActive && st.rowNamePlaying]} numberOfLines={1}>
            {track.name}
          </Text>
        </Pressable>
      </Swipeable>
    </Animated.View>
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
  const player   = useMusicPlayer();

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const tracksRef = useRef<MusicTrack[]>([]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  // Load once on mount (not useFocusEffect — DocumentPicker refocus causes races)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw) as MusicTrack[];
        setTracks(parsed);
        tracksRef.current = parsed;
      }
    });
  }, []);

  // Animated player bottom sheet
  const playerAnim   = useRef(new Animated.Value(0)).current;
  const playerVisRef = useRef(false);
  useEffect(() => {
    const shouldShow = player.track !== null;
    if (shouldShow === playerVisRef.current) return;
    playerVisRef.current = shouldShow;
    Animated.spring(playerAnim, {
      toValue: shouldShow ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 14,
    }).start();
  }, [player.track !== null]);

  const playerHeight  = playerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, PLAYER_H] });
  const playerOpacity = playerAnim;

  const saveTracks = async (list: MusicTrack[]) => {
    tracksRef.current = list;
    setTracks(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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

      const newTracks: MusicTrack[] = [];
      for (const asset of result.assets) {
        const fileName    = asset.name ?? `track_${Date.now()}.mp3`;
        const destUri     = MUSIC_DIR + fileName;
        try {
          const info = await FileSystem.getInfoAsync(destUri);
          if (!info.exists) await FileSystem.copyAsync({ from: asset.uri, to: destUri });
          const displayName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
          newTracks.push({ id: destUri, name: displayName, uri: destUri });
        } catch (err) { console.warn("copy failed:", fileName, err); }
      }
      if (newTracks.length) {
        const cur    = tracksRef.current;
        const merged = [...cur, ...newTracks.filter(t => !cur.find(x => x.id === t.id))];
        await saveTracks(merged);
      }
    } catch (err) { console.error("picker error:", err); }
  };

  const handleDelete = async (idx: number) => {
    const list  = tracksRef.current;
    const track = list[idx];
    try { await FileSystem.deleteAsync(track.uri, { idempotent: true }); } catch {}
    await saveTracks(list.filter((_, i) => i !== idx));
  };

  const progressBarWidth = useRef(0);
  const handleSeek = (e: any) => {
    const x = e.nativeEvent.locationX;
    const w = progressBarWidth.current;
    if (!w || !player.durMs) return;
    player.seekTo(Math.floor(Math.max(0, Math.min(1, x / w)) * player.durMs));
  };

  const progress = player.durMs > 0 ? player.posMs / player.durMs : 0;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={[st.inner, isTablet && st.innerTablet]}>

        {/* Header — press to go back, long-press EQ to add tracks */}
        <View style={st.headerArea}>
          <Pressable style={st.eqWrap} onPress={() => router.back()} onLongPress={pickFiles} delayLongPress={400}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => <EqBar key={i} index={i} />)}
          </Pressable>
          <Text style={st.pageTitle}>My Music</Text>
        </View>

        {/* Track list or empty state */}
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
          <ScrollView style={st.list} contentContainerStyle={st.listContent} showsVerticalScrollIndicator={false}>
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                isActive={player.track?.id === track.id}
                isPlaying={player.isPlaying}
                onPlay={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); player.playTrack(i, tracks); }}
                onDelete={() => handleDelete(i)}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Player bottom sheet — identical layout to Music home screen ─────── */}
        <Animated.View style={[st.playerWrap, { height: playerHeight, opacity: playerOpacity }]}>
          <View style={[st.playerPanel, { paddingBottom: insets.bottom + 12 }]}>

            {/* Top row: artwork + title + time */}
            <View style={st.npTop}>
              <View style={st.npArt}>
                <Feather name="music" size={30} color={RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.npTitle} numberOfLines={1}>
                  {player.track?.name ?? ""}
                </Text>
                <Text style={st.npArtist} numberOfLines={1}>
                  {player.durMs > 0
                    ? `${fmtMs(player.posMs)} / ${fmtMs(player.durMs)}`
                    : "Loading..."}
                </Text>
              </View>
            </View>

            {/* Progress bar — 24px hit area wrapping the 4px visible track */}
            <View
              style={st.progressHitArea}
              onLayout={e => { progressBarWidth.current = e.nativeEvent.layout.width; }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={handleSeek}
              onResponderMove={handleSeek}
              onResponderRelease={handleSeek}
            >
              <View style={st.progressWrap}>
                <View style={[st.progressFill, { width: `${(progress * 100).toFixed(1)}%` }]} />
              </View>
            </View>

            {/* Controls */}
            <View style={st.controls}>
              <Pressable style={st.ctrlBtn} onPress={() => player.skipBack()}>
                <Feather name="skip-back" size={26} color="rgba(255,255,255,0.6)" />
              </Pressable>
              <Pressable style={st.playBtn} onPress={() => player.togglePlay()}>
                <Feather name={player.isPlaying ? "pause" : "play"} size={24} color="#fff" />
              </Pressable>
              <Pressable style={st.ctrlBtn} onPress={() => player.skipForward()}>
                <Feather name="skip-forward" size={26} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

          </View>
        </Animated.View>

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

  // Track row — ITEM_H = 48, same as Life Admin
  row: {
    height: ITEM_H,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14,
  },
  rowActive:      { borderColor: "rgba(224,49,49,0.35)" },
  rowIcon: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: ROW_BG, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  rowIconActive:  { borderColor: "rgba(224,49,49,0.3)" },
  rowName:        { flex: 1, fontSize: 14, color: "#fff", fontFamily: "Inter_500Medium" },
  rowNamePlaying: { color: RED },

  // Delete action — Life Admin spec
  deleteAction: {
    width: 110, height: ITEM_H,
    backgroundColor: RED,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
  },
  deletePillTx: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Empty state
  emptyState:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
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

  // ── Player — identical spec to Music home screen ──────────────────────────
  playerWrap: {
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 20,
  },
  playerPanel: {
    flex: 1,
    backgroundColor: ROW_BG, borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 24,
  },
  npTop: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  npArt: {
    width: 80, height: 80, borderRadius: 14,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  npTitle:  { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 4 },
  npArtist: { fontSize: 13, fontFamily: "Inter_400Regular", color: GREY },
  progressHitArea: { height: 24, justifyContent: "center", marginBottom: 30 },
  progressWrap: {
    height: 4, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: RED, borderRadius: 2 },
  controls:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 36, marginBottom: 14 },
  ctrlBtn:      { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.45,
  },
});
