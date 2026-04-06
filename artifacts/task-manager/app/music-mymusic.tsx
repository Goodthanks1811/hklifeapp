import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Swipeable } from "react-native-gesture-handler";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
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

const ITEM_H    = 52;
const ITEM_GAP  = 8;
const SLOT_H    = ITEM_H + ITEM_GAP;
const PLAYER_H  = 280;

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H       = 42;
const MIN_H       = 5;

const STORAGE_KEY = "mymusic_tracks_v2";
const MUSIC_DIR   = (FileSystem.documentDirectory ?? "") + "music/";

// ── Path helpers (mirrors Mi Corazon pattern) ─────────────────────────────────
// Store relative paths (e.g. "music/song.mp3") so URIs survive new builds.
// iOS assigns a new container UUID on fresh install, breaking absolute paths.
function toRel(uri: string): string {
  if (!uri) return uri;
  const idx = uri.indexOf("music/");
  return idx !== -1 ? uri.slice(idx) : uri;
}
function toAbs(uri: string): string {
  if (!uri || uri.startsWith("file://") || uri.startsWith("http")) return uri;
  return (FileSystem.documentDirectory ?? "") + uri;
}

// Static zero — passed as dimValue to the dragging row so it never dims itself
const ZERO_ANIM = new Animated.Value(0);
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

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

// ── Swipeable track row — identical drag wiring to Life Admin ──────────────────
function TrackRow({
  track, isActive, isPlaying, isDragging, dimValue, onPlay, onDelete, onLongPress,
}: {
  track: MusicTrack; isActive: boolean; isPlaying: boolean;
  isDragging: boolean; dimValue: Animated.Value;
  onPlay: () => void; onDelete: () => void; onLongPress: () => void;
}) {
  const swipeRef    = useRef<Swipeable>(null);
  const revealedRef = useRef(false);
  const deletingRef = useRef(false);
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const rowHeight   = useRef(new Animated.Value(ITEM_H)).current;

  // Combined opacity: delete fade × drag dim (identical to Life Admin)
  const combinedOpacity = Animated.multiply(
    opacityAnim,
    dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] })
  );

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeRef.current?.close();
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(rowHeight,   { toValue: 0, duration: 260, delay: 40, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(() => onDelete());
  }, [onDelete]);

  const renderRightActions = useCallback(() => (
    <Pressable style={st.deleteAction} onPress={triggerDelete}>
      <Feather name="trash-2" size={16} color="#fff" />
      <Text style={st.deletePillTx}>Delete</Text>
    </Pressable>
  ), [triggerDelete]);

  return (
    <Animated.View style={{ height: rowHeight, opacity: combinedOpacity }}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        rightThreshold={40}
        friction={3}
        enabled={!isDragging && !deletingRef.current}
        onSwipeableOpen={() => { revealedRef.current = true; }}
        onSwipeableClose={() => { revealedRef.current = false; }}
        containerStyle={{ borderRadius: 14, overflow: "hidden" }}
      >
        <Pressable
          style={[st.row, isActive && st.rowActive, isDragging && st.rowDragging]}
          onPress={() => revealedRef.current ? swipeRef.current?.close() : onPlay()}
          onLongPress={() => { if (!revealedRef.current) onLongPress(); }}
          delayLongPress={200}
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
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as MusicTrack[];

      // Ensure all stored URIs are relative (toRel is a no-op if already relative).
      // Migrates any old absolute-path entries from builds before this fix.
      const relativised = parsed.map(t => {
        const rel = toRel(t.uri);
        return { ...t, id: rel, uri: rel };
      });

      // Validate: drop tracks whose files no longer exist on disk
      const valid: MusicTrack[] = [];
      for (const t of relativised) {
        try {
          const info = await FileSystem.getInfoAsync(toAbs(t.uri));
          if (info.exists) valid.push(t);
          else console.warn("[MyMusic] file missing, removing:", t.uri);
        } catch {
          console.warn("[MyMusic] could not stat, removing:", t.uri);
        }
      }

      setTracks(valid);
      tracksRef.current = valid;

      // Persist if anything changed (migration or pruning)
      const changed = valid.length !== parsed.length ||
        relativised.some((t, i) => t.uri !== parsed[i]?.uri);
      if (changed) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    })();
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
          const relUri = toRel(destUri);
          newTracks.push({ id: relUri, name: displayName, uri: relUri });
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
    try { await FileSystem.deleteAsync(toAbs(track.uri), { idempotent: true }); } catch {}
    await saveTracks(list.filter((_, i) => i !== idx));
  };

  // ── Smooth scrubber ─────────────────────────────────────────────────────────
  const barRef    = useRef<View>(null);
  const barLeft   = useRef(0);
  const barWidth  = useRef(0);
  const durMsRef  = useRef(player.durMs);
  const seekToRef = useRef(player.seekTo);
  durMsRef.current  = player.durMs;
  seekToRef.current = player.seekTo;

  const isScrubbing = useRef(false);
  const scrubAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isScrubbing.current && player.durMs > 0) {
      scrubAnim.setValue(player.posMs / player.durMs);
    }
  }, [player.posMs, player.durMs]);

  const fillWidth = scrubAnim.interpolate({
    inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp",
  });

  const scrubber = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        if (!barWidth.current || !durMsRef.current) return;
        isScrubbing.current = true;
        scrubAnim.setValue(Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current)));
      },
      onPanResponderMove: (e) => {
        if (!barWidth.current) return;
        scrubAnim.setValue(Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current)));
      },
      onPanResponderRelease: (e) => {
        isScrubbing.current = false;
        if (!barWidth.current || !durMsRef.current) return;
        const ratio = Math.max(0, Math.min(1, (e.nativeEvent.pageX - barLeft.current) / barWidth.current));
        scrubAnim.setValue(ratio);
        seekToRef.current(Math.floor(ratio * durMsRef.current));
      },
      onPanResponderTerminate: () => { isScrubbing.current = false; },
    })
  ).current;

  // ── Drag & drop — identical to Life Admin ────────────────────────────────────
  const posAnims        = useRef<Record<string, Animated.Value>>({});
  const addedAnims      = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const containerRef    = useRef<View>(null);
  const containerTopRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const startScrollRef  = useRef(0);
  const isDraggingRef   = useRef(false);
  const draggingIdxRef  = useRef(-1);
  const hoverIdxRef     = useRef(-1);
  const dragOccurredRef = useRef(false);
  const panY            = useRef(new Animated.Value(0)).current;
  const dimAnim         = useRef(new Animated.Value(0)).current;
  const [dragActiveIdx, setDragActiveIdx] = useState(-1);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  // Initialise position anim for any new track
  tracks.forEach((t, i) => {
    if (!posAnims.current[t.id]) {
      posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
      addedAnims.current[t.id] = Animated.add(posAnims.current[t.id], panY);
    }
  });

  // Snap positions whenever tracks list changes (e.g. after delete or initial load)
  useEffect(() => {
    if (!isDraggingRef.current) {
      tracksRef.current.forEach((t, i) => {
        posAnims.current[t.id]?.setValue(i * SLOT_H);
      });
    }
  }, [tracks]);

  const animatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const cur = tracksRef.current;
    cur.forEach((t, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      posAnims.current[t.id]?.stopAnimation();
      Animated.timing(posAnims.current[t.id], {
        toValue: target * SLOT_H, duration: 110, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    });
  }, []);

  const startDrag = useCallback((idx: number) => {
    isDraggingRef.current  = true;
    draggingIdxRef.current = idx;
    hoverIdxRef.current    = idx;
    dragOccurredRef.current = true;
    setDragActiveIdx(idx);
    setListScrollEnabled(false);
    panY.setValue(0);
    Animated.timing(dimAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startScrollRef.current = scrollOffsetRef.current;
    containerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      containerTopRef.current = py;
    });
  }, [dimAnim]);

  const endDrag = useCallback(() => {
    const di = draggingIdxRef.current;
    const hi = hoverIdxRef.current;
    isDraggingRef.current  = false;
    draggingIdxRef.current = -1;
    hoverIdxRef.current    = -1;
    panY.setValue(0);
    setListScrollEnabled(true);
    Animated.timing(dimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

    if (di >= 0 && hi >= 0 && di !== hi) {
      setTracks(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
        tracksRef.current = next;
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } else {
      tracksRef.current.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
    }
    setDragActiveIdx(-1);
    setTimeout(() => { dragOccurredRef.current = false; }, 80);
  }, []);

  const dragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isDraggingRef.current) return;
      const di  = draggingIdxRef.current;
      const len = tracksRef.current.length;
      panY.setValue(gs.dy);
      const relY     = gs.moveY - containerTopRef.current + (scrollOffsetRef.current - startScrollRef.current);
      const newHover = clamp(0, len - 1, Math.floor(relY / SLOT_H));
      if (newHover !== hoverIdxRef.current) {
        hoverIdxRef.current = newHover;
        animatePositions(di, newHover);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderEnd:       () => endDrag(),
    onPanResponderTerminate: () => endDrag(),
  }), [animatePositions, endDrag]);

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={[st.inner, isTablet && st.innerTablet]}>

        {/* Header — press to go back, long-press EQ to add tracks */}
        <View style={st.headerArea}>
          <Pressable style={st.eqWrap} onPress={() => router.back()} onLongPress={pickFiles} delayLongPress={400}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => <EqBar key={i} index={i} />)}
          </Pressable>
          <Text style={st.pageTitle}>My Music</Text>
          <Pressable style={st.backZone} onPress={() => router.back()} />
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
          <ScrollView
            style={st.list}
            scrollEnabled={listScrollEnabled}
            showsVerticalScrollIndicator={false}
            onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
          >
            {/* Absolute-position container — enables live drag animation (Life Admin pattern) */}
            <View
              ref={containerRef}
              {...dragResponder.panHandlers}
              style={{ height: Math.max(tracks.length, 1) * SLOT_H + 16, marginHorizontal: 16 }}
            >
              {/* Tap-anywhere-to-cancel overlay — above non-dragging rows, below dragging row */}
              {dragActiveIdx !== -1 && (
                <Pressable
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                  onPress={() => endDrag()}
                />
              )}
              {tracks.map((track, idx) => {
                const isDragging = dragActiveIdx === idx;
                const posAnim    = posAnims.current[track.id] ?? new Animated.Value(idx * SLOT_H);
                const translateY = isDragging
                  ? (addedAnims.current[track.id] ?? posAnim)
                  : posAnim;
                return (
                  <Animated.View
                    key={track.id}
                    style={[
                      st.absItem,
                      { top: 0, zIndex: isDragging ? 100 : 1, transform: [{ translateY }] },
                    ]}
                  >
                    <TrackRow
                      track={track}
                      isActive={player.track?.id === track.id}
                      isPlaying={player.isPlaying}
                      isDragging={isDragging}
                      dimValue={isDragging ? ZERO_ANIM : dimAnim}
                      onPlay={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); player.playTrack(idx, tracks.map(t => ({ ...t, uri: toAbs(t.uri) }))); }}
                      onDelete={() => handleDelete(idx)}
                      onLongPress={() => startDrag(idx)}
                    />
                  </Animated.View>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ── Player bottom sheet — identical layout to Music home screen ─────── */}
        <Animated.View style={[st.playerWrap, { height: playerHeight, opacity: playerOpacity }]}>
          <View style={[st.playerPanel, { paddingBottom: insets.bottom + 12 }]}>

            {/* Top row: artwork + title */}
            <View style={st.npTop}>
              <View style={st.npArt}>
                <Feather name="music" size={22} color={RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.npTitle} numberOfLines={1}>
                  {player.track?.name ?? ""}
                </Text>
              </View>
            </View>

            {/* Progress bar — 24px hit area, PanResponder for smooth dragging */}
            <View
              ref={barRef}
              style={st.progressHitArea}
              onLayout={() => {
                barRef.current?.measure((_fx, _fy, w, _h, px) => {
                  barLeft.current  = px;
                  barWidth.current = w;
                });
              }}
              {...scrubber.panHandlers}
            >
              <View style={st.progressTrack}>
                <Animated.View style={[st.progressFill, { width: fillWidth }]}>
                  <View style={st.progressThumb} />
                </Animated.View>
              </View>
            </View>

            {/* Timestamps below scrubber */}
            <View style={st.timeRow}>
              <Text style={st.timeText}>{fmtMs(player.posMs)}</Text>
              <Text style={st.timeText}>{player.durMs > 0 ? fmtMs(player.durMs) : "--:--"}</Text>
            </View>

            {/* Controls */}
            <View style={st.controls}>
              <Pressable style={st.ctrlBtn} onPress={() => player.skipBack()}>
                <Ionicons name="play-skip-back" size={30} color="#fff" />
              </Pressable>
              <Pressable style={st.playBtn} onPress={() => player.togglePlay()}>
                <Ionicons name={player.isPlaying ? "pause" : "play"} size={30} color="#fff" />
              </Pressable>
              <Pressable style={st.ctrlBtn} onPress={() => player.skipForward()}>
                <Ionicons name="play-skip-forward" size={30} color="#fff" />
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

  headerArea: { backgroundColor: BG, paddingTop: 28, paddingBottom: 4, alignItems: "center", position: "relative" },
  backZone: { position: "absolute", left: 0, top: 0, bottom: 0, width: 80 },
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

  list: { flex: 1 },

  // Absolute-position item container — same as Life Admin's absItem
  absItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },

  // Track row
  row: {
    height: ITEM_H,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14,
  },
  rowActive:   { borderColor: "rgba(255,255,255,0.28)" },
  rowDragging: {
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: ROW_BG, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  rowIconActive:  { borderColor: "rgba(255,255,255,0.28)" },
  rowName:        { flex: 1, fontSize: 14, color: "#fff", fontFamily: "Inter_500Medium" },
  rowNamePlaying: { color: RED },

  // Delete action
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
    backgroundColor: ROW_BG,
    borderTopWidth: 1, borderTopColor: BORDER,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10,
  },
  npTop: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 },
  npArt: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  npTitle:  { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  progressHitArea: { height: 24, justifyContent: "center", marginBottom: 4 },
  timeRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  timeText: { fontSize: 12, fontFamily: "Inter_400Regular", color: GREY },
  progressTrack: {
    height: 4, backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2, overflow: "visible",
  },
  progressFill: {
    height: "100%", backgroundColor: RED,
    borderRadius: 2, overflow: "visible",
  },
  progressThumb: {
    position: "absolute", right: -6, top: -4,
    width: 12, height: 12, borderRadius: 6, backgroundColor: RED,
  },
  controls:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 14 },
  ctrlBtn:      { width: 62, height: 62, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.45,
  },
});
