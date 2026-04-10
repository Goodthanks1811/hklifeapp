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
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useMusicPlayer, MusicTrack } from "@/context/MusicPlayerContext";

const RED    = "#E03131";
const BG     = "#111111";
const BORDER = "#2A2A2A";
const GREY   = "#888";

const ITEM_H   = 64;
const ITEM_GAP = 10;
const SLOT_H   = ITEM_H + ITEM_GAP;

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H       = 42;
const MIN_H       = 5;

const SCREEN_W    = Dimensions.get("window").width;
const TILE_GAP    = 12;
const TILE_W      = (SCREEN_W - 32 - TILE_GAP) / 2;

const TRACKS_KEY   = "mymusic_tracks_v2";
const PLAYLISTS_KEY = "mymusic_playlists_v1";
const MUSIC_DIR    = (FileSystem.documentDirectory ?? "") + "music/";

type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  trackIds: string[];
};

function toRel(uri: string): string {
  if (!uri) return uri;
  const idx = uri.indexOf("music/");
  return idx !== -1 ? uri.slice(idx) : uri;
}
function toAbs(uri: string): string {
  if (!uri || uri.startsWith("file://") || uri.startsWith("http")) return uri;
  return (FileSystem.documentDirectory ?? "") + uri;
}

const ZERO_ANIM = new Animated.Value(0);
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

// ── EQ bar ────────────────────────────────────────────────────────────────────
function EqBar({ index }: { index: number }) {
  const height = useRef(new Animated.Value(MIN_H)).current;
  useEffect(() => {
    const dur  = 900 + index * 120;
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

// ── Playlist tile ─────────────────────────────────────────────────────────────
function PlaylistTile({
  playlist, trackCount, onPress, onLongPress,
}: {
  playlist: Playlist; trackCount: number;
  onPress: () => void; onLongPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 20 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        delayLongPress={350}
        style={st.tile}
      >
        <View style={st.tileArtwork}>
          <View style={st.tileIconBox}>
            <Feather name="music" size={26} color={RED} />
          </View>
          {trackCount > 0 && (
            <View style={st.tileBadge}>
              <Text style={st.tileBadgeText}>{trackCount}</Text>
            </View>
          )}
        </View>
        <Text style={st.tileName} numberOfLines={2}>{playlist.name}</Text>
        <Text style={st.tileCount}>{trackCount === 0 ? "No songs" : `${trackCount} song${trackCount === 1 ? "" : "s"}`}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Track row ─────────────────────────────────────────────────────────────────
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
    <View style={st.deleteZone}>
      <Pressable style={st.deleteAction} onPress={triggerDelete}>
        <Feather name="trash-2" size={20} color="#fff" />
      </Pressable>
    </View>
  ), [triggerDelete]);

  return (
    <Animated.View style={{ height: rowHeight, opacity: combinedOpacity }}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        rightThreshold={28}
        friction={1.5}
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
          {isActive && <View style={st.rowActiveLine} />}
          <View style={[st.rowIcon, isActive && st.rowIconActive]}>
            <Feather
              name={isActive && isPlaying ? "volume-2" : "music"}
              size={17}
              color={isActive ? RED : "#555"}
            />
          </View>
          <View style={st.rowInfo}>
            <Text style={[st.rowName, isActive && st.rowNamePlaying]} numberOfLines={1}>
              {track.name}
            </Text>
            {isActive && (
              <Text style={st.rowPlayingLabel}>
                {isPlaying ? "● NOW PLAYING" : "● PAUSED"}
              </Text>
            )}
          </View>
          <Feather name="menu" size={14} color="#3A3A3A" style={{ marginLeft: 4 }} />
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MusicMyMusicScreen() {
  const goBack   = () => router.back();
  const insets   = useSafeAreaInsets();
  const isTablet = SCREEN_W >= 768;
  const player   = useMusicPlayer();

  // ── Tracks ────────────────────────────────────────────────────────────────
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const tracksRef = useRef<MusicTrack[]>([]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  // ── Playlists ─────────────────────────────────────────────────────────────
  const [playlists, setPlaylists]         = useState<Playlist[]>([]);
  const playlistsRef                      = useRef<Playlist[]>([]);
  const [showEQMenu, setShowEQMenu]       = useState(false);
  const [showNewPL, setShowNewPL]         = useState(false);
  const [newPLName, setNewPLName]         = useState("");
  const [plMenuId, setPlMenuId]           = useState<string | null>(null);
  const newPLInputRef                     = useRef<TextInput>(null);
  const keyboardOffset                    = useRef(new Animated.Value(0)).current;
  const isPickingRef                      = useRef(false);
  const pickTimerRef                      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shift for new playlist bottom sheet (project rule: never KeyboardAvoidingView)
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", e => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener("keyboardWillHide", e => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 200,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Load on mount
  useEffect(() => {
    (async () => {
      const [rawTracks, rawPlaylists] = await Promise.all([
        AsyncStorage.getItem(TRACKS_KEY),
        AsyncStorage.getItem(PLAYLISTS_KEY),
      ]);

      if (rawTracks) {
        const parsed = JSON.parse(rawTracks) as MusicTrack[];
        const relativised = parsed.map(t => {
          const rel = toRel(t.uri);
          return { ...t, id: rel, uri: rel };
        });
        const valid: MusicTrack[] = [];
        for (const t of relativised) {
          try {
            const info = await FileSystem.getInfoAsync(toAbs(t.uri));
            if (info.exists) valid.push(t);
          } catch {}
        }
        setTracks(valid);
        tracksRef.current = valid;
        const changed = valid.length !== parsed.length ||
          relativised.some((t, i) => t.uri !== parsed[i]?.uri);
        if (changed) AsyncStorage.setItem(TRACKS_KEY, JSON.stringify(valid));
      }

      if (rawPlaylists) {
        const parsed = JSON.parse(rawPlaylists) as Playlist[];
        setPlaylists(parsed);
        playlistsRef.current = parsed;
      }
    })();
  }, []);

  // ── Persistence ───────────────────────────────────────────────────────────
  const saveTracks = async (list: MusicTrack[]) => {
    tracksRef.current = list;
    setTracks(list);
    await AsyncStorage.setItem(TRACKS_KEY, JSON.stringify(list));
  };

  const savePlaylists = async (list: Playlist[]) => {
    playlistsRef.current = list;
    setPlaylists(list);
    await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(list));
  };

  // ── Playlist actions ──────────────────────────────────────────────────────
  const createPlaylist = async () => {
    const name = newPLName.trim();
    if (!name) return;
    Keyboard.dismiss();
    const pl: Playlist = { id: `pl_${Date.now()}`, name, createdAt: Date.now(), trackIds: [] };
    await savePlaylists([...playlistsRef.current, pl]);
    setShowNewPL(false);
    setNewPLName("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deletePlaylist = async (id: string) => {
    await savePlaylists(playlistsRef.current.filter(p => p.id !== id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const playPlaylist = (playlist: Playlist) => {
    const pts = playlist.trackIds
      .map(id => tracksRef.current.find(t => t.id === id))
      .filter(Boolean) as MusicTrack[];
    if (!pts.length) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    player.playTrack(0, pts.map(t => ({ ...t, uri: toAbs(t.uri) })));
  };

  // ── File picker (library + optional playlist target) ───────────────────────
  const pickFiles = async (targetPlaylistId?: string) => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: true,
        copyToCacheDirectory: false,
      });
      if (result.canceled || !result.assets?.length) return;
      await FileSystem.makeDirectoryAsync(MUSIC_DIR, { intermediates: true });

      const newTracks: MusicTrack[] = [];
      const newIds: string[] = [];
      for (const asset of result.assets) {
        const fileName = asset.name ?? `track_${Date.now()}.mp3`;
        const destUri  = MUSIC_DIR + fileName;
        try {
          const info = await FileSystem.getInfoAsync(destUri);
          if (!info.exists) await FileSystem.copyAsync({ from: asset.uri, to: destUri });
          const displayName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
          const relUri = toRel(destUri);
          newTracks.push({ id: relUri, name: displayName, uri: relUri });
          newIds.push(relUri);
        } catch (err) { console.warn("copy failed:", fileName, err); }
      }

      if (newTracks.length) {
        const cur    = tracksRef.current;
        const merged = [...cur, ...newTracks.filter(t => !cur.find(x => x.id === t.id))];
        await saveTracks(merged);

        if (targetPlaylistId) {
          const pls = playlistsRef.current;
          const pl  = pls.find(p => p.id === targetPlaylistId);
          if (pl) {
            const updatedIds = [...pl.trackIds, ...newIds.filter(id => !pl.trackIds.includes(id))];
            await savePlaylists(pls.map(p => p.id === targetPlaylistId ? { ...p, trackIds: updatedIds } : p));
          }
        }
      }
    } catch (err) { console.warn("picker dismissed or error:", err); }
    finally { isPickingRef.current = false; }
  };

  const schedulePick = (targetPlaylistId?: string) => {
    if (pickTimerRef.current) clearTimeout(pickTimerRef.current);
    pickTimerRef.current = setTimeout(() => pickFiles(targetPlaylistId), 350);
  };

  const handleDelete = async (idx: number) => {
    const list  = tracksRef.current;
    const track = list[idx];
    try { await FileSystem.deleteAsync(toAbs(track.uri), { idempotent: true }); } catch {}
    // Also remove from all playlists
    const updatedPls = playlistsRef.current.map(p => ({
      ...p, trackIds: p.trackIds.filter(id => id !== track.id),
    }));
    await savePlaylists(updatedPls);
    await saveTracks(list.filter((_, i) => i !== idx));
  };

  // ── Player bottom sheet animation ─────────────────────────────────────────
  const playerAnim   = useRef(new Animated.Value(0)).current;
  const playerVisRef = useRef(false);
  useEffect(() => {
    const shouldShow = player.track !== null;
    if (shouldShow === playerVisRef.current) return;
    playerVisRef.current = shouldShow;
    Animated.spring(playerAnim, { toValue: shouldShow ? 1 : 0, useNativeDriver: false, tension: 120, friction: 14 }).start();
  }, [player.track !== null]);

  // ── Scrubber ──────────────────────────────────────────────────────────────
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

  const fillWidth = scrubAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"], extrapolate: "clamp" });

  const scrubber = useRef(PanResponder.create({
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
  })).current;

  // ── Drag & drop ───────────────────────────────────────────────────────────
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
  const [dragActiveIdx, setDragActiveIdx]     = useState(-1);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  tracks.forEach((t, i) => {
    if (!posAnims.current[t.id]) {
      posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
      addedAnims.current[t.id] = Animated.add(posAnims.current[t.id], panY);
    }
  });

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
    isDraggingRef.current   = true;
    draggingIdxRef.current  = idx;
    hoverIdxRef.current     = idx;
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
        AsyncStorage.setItem(TRACKS_KEY, JSON.stringify(next));
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

  const isEmpty = tracks.length === 0 && playlists.length === 0;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={[st.inner, isTablet && st.innerTablet]}>

        {/* Header */}
        <View style={st.headerArea}>
          <Pressable
            style={st.eqWrap}
            onPress={goBack}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowEQMenu(true);
            }}
            delayLongPress={400}
          >
            {Array.from({ length: BAR_COUNT }).map((_, i) => <EqBar key={i} index={i} />)}
          </Pressable>
          <Text style={st.pageTitle}>My Music</Text>
          <Pressable style={st.backZone} onPress={goBack} />
        </View>

        {/* Content */}
        {isEmpty ? (
          /* Empty state */
          <View style={st.emptyState}>
            <Feather name="music" size={44} color="rgba(255,255,255,0.1)" />
            <Text style={st.emptyTitle}>No tracks yet</Text>
            <Text style={st.emptySubtitle}>Long press the equaliser above to add music or create a playlist</Text>
            <Pressable style={st.emptyBtn} onPress={() => schedulePick()}>
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
            contentContainerStyle={{ paddingTop: 16, paddingBottom: player.track ? 330 : 40 }}
          >
            {/* ── Playlists section ──────────────────────────────────── */}
            {playlists.length > 0 && (
              <View style={st.section}>
                <Text style={st.sectionHeader}>Playlists</Text>
                <View style={st.playlistGrid}>
                  {playlists.map((pl, idx) => {
                    const count = pl.trackIds.filter(id => tracksRef.current.find(t => t.id === id)).length;
                    const isLastOdd = playlists.length % 2 === 1 && idx === playlists.length - 1;
                    return (
                      <View key={pl.id} style={[st.tileWrapper, isLastOdd && { marginRight: "auto" }]}>
                        <PlaylistTile
                          playlist={pl}
                          trackCount={count}
                          onPress={() => playPlaylist(pl)}
                          onLongPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setPlMenuId(pl.id);
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Songs section ──────────────────────────────────────── */}
            {tracks.length > 0 && (
              <View style={st.section}>
                <Text style={st.sectionHeader}>Songs</Text>
                <View
                  ref={containerRef}
                  {...dragResponder.panHandlers}
                  style={{ height: Math.max(tracks.length, 1) * SLOT_H, marginHorizontal: 16 }}
                >
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
                        style={[st.absItem, { top: 0, zIndex: isDragging ? 100 : 1, transform: [{ translateY }] }]}
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
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── EQ long-press menu ────────────────────────────────────────────── */}
      <Modal
        visible={showEQMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEQMenu(false)}
      >
        <Pressable style={st.modalOverlay} onPress={() => setShowEQMenu(false)}>
          <Animated.View style={st.actionSheet}>
            <View style={st.sheetHandle} />

            <Pressable
              style={st.sheetOption}
              onPress={() => { setShowEQMenu(false); schedulePick(); }}
            >
              <View style={st.sheetIconWrap}>
                <Feather name="music" size={20} color={RED} />
              </View>
              <View>
                <Text style={st.sheetOptionTitle}>Add Songs</Text>
                <Text style={st.sheetOptionSub}>Import audio files from your phone</Text>
              </View>
            </Pressable>

            <View style={st.sheetDivider} />

            <Pressable
              style={st.sheetOption}
              onPress={() => { setShowEQMenu(false); setTimeout(() => { setShowNewPL(true); setTimeout(() => newPLInputRef.current?.focus(), 100); }, 300); }}
            >
              <View style={st.sheetIconWrap}>
                <Feather name="folder-plus" size={20} color={RED} />
              </View>
              <View>
                <Text style={st.sheetOptionTitle}>New Playlist</Text>
                <Text style={st.sheetOptionSub}>Create a playlist and add songs to it</Text>
              </View>
            </Pressable>

            <Pressable style={st.sheetCancel} onPress={() => setShowEQMenu(false)}>
              <Text style={st.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Playlist long-press menu ──────────────────────────────────────── */}
      <Modal
        visible={plMenuId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPlMenuId(null)}
      >
        <Pressable style={st.modalOverlay} onPress={() => setPlMenuId(null)}>
          <Animated.View style={st.actionSheet}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>
              {playlists.find(p => p.id === plMenuId)?.name ?? ""}
            </Text>

            <Pressable
              style={st.sheetOption}
              onPress={() => {
                const id = plMenuId;
                setPlMenuId(null);
                schedulePick(id ?? undefined);
              }}
            >
              <View style={st.sheetIconWrap}>
                <Feather name="plus-circle" size={20} color={RED} />
              </View>
              <View>
                <Text style={st.sheetOptionTitle}>Add Songs</Text>
                <Text style={st.sheetOptionSub}>Add audio files to this playlist</Text>
              </View>
            </Pressable>

            <View style={st.sheetDivider} />

            <Pressable
              style={st.sheetOption}
              onPress={() => {
                const id = plMenuId;
                setPlMenuId(null);
                if (id) deletePlaylist(id);
              }}
            >
              <View style={[st.sheetIconWrap, { backgroundColor: "rgba(224,49,49,0.12)" }]}>
                <Feather name="trash-2" size={20} color={RED} />
              </View>
              <View>
                <Text style={[st.sheetOptionTitle, { color: RED }]}>Delete Playlist</Text>
                <Text style={st.sheetOptionSub}>Songs remain in your library</Text>
              </View>
            </Pressable>

            <Pressable style={st.sheetCancel} onPress={() => setPlMenuId(null)}>
              <Text style={st.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── New Playlist bottom sheet ─────────────────────────────────────── */}
      <Modal
        visible={showNewPL}
        transparent
        animationType="fade"
        onRequestClose={() => { Keyboard.dismiss(); setShowNewPL(false); setNewPLName(""); }}
      >
        <Pressable
          style={st.modalOverlay}
          onPress={() => { Keyboard.dismiss(); setShowNewPL(false); setNewPLName(""); }}
        >
          <Animated.View style={[st.newPLSheet, { bottom: keyboardOffset }]}>
            <Pressable onPress={() => {}} /* Absorb taps inside sheet */>
              <View style={st.sheetHandle} />
              <Text style={st.newPLLabel}>Playlist Name</Text>
              <TextInput
                ref={newPLInputRef}
                style={st.newPLInput}
                placeholder="My Playlist"
                placeholderTextColor={GREY}
                value={newPLName}
                onChangeText={setNewPLName}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={createPlaylist}
                maxLength={60}
                keyboardAppearance="dark"
                selectionColor={RED}
                autoFocus
              />
              <View style={st.newPLFooter}>
                <Pressable
                  style={st.newPLCancel}
                  onPress={() => { Keyboard.dismiss(); setShowNewPL(false); setNewPLName(""); }}
                >
                  <Text style={st.newPLCancelText}>Close</Text>
                </Pressable>
                <Pressable
                  style={[st.newPLCreate, !newPLName.trim() && { opacity: 0.42 }]}
                  onPress={createPlaylist}
                  disabled={!newPLName.trim()}
                >
                  <Feather name="plus" size={15} color="#fff" />
                  <Text style={st.newPLCreateText}>Create Playlist</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 800, alignSelf: "center", width: "100%" },

  headerArea: {
    backgroundColor: BG, paddingTop: 28, paddingBottom: 4,
    alignItems: "center", position: "relative",
  },
  backZone: { position: "absolute", left: 0, top: 0, bottom: 0, right: "50%" },
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

  // Section layout
  section:       { marginBottom: 8 },
  sectionHeader: {
    color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold",
    marginHorizontal: 16, marginBottom: 12, marginTop: 4,
  },

  // Playlist grid
  playlistGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 16, gap: TILE_GAP,
  },
  tileWrapper: { width: TILE_W },

  // Playlist tile
  tile: { width: TILE_W },
  tileArtwork: {
    width: TILE_W, height: TILE_W,
    borderRadius: 14, backgroundColor: "#1C1C1E",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 8,
  },
  tileIconBox: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: "rgba(227,28,28,0.10)",
    borderWidth: 1, borderColor: "rgba(227,28,28,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  tileBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: RED, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 5,
  },
  tileBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  tileName:  {
    color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold",
    marginTop: 10, lineHeight: 18,
  },
  tileCount: { color: "#666", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },

  // Track list
  absItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },
  row: {
    height: ITEM_H, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1C1C1E",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, paddingHorizontal: 14,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 6,
  },
  rowActiveLine: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: RED,
  },
  rowActive: {
    borderColor: "rgba(227,28,28,0.28)",
  },
  rowDragging: {
    backgroundColor: "#252525",
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 18,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
  },
  rowIconActive: {
    backgroundColor: "rgba(227,28,28,0.14)",
    borderColor: "rgba(227,28,28,0.30)",
  },
  rowInfo:        { flex: 1, gap: 3 },
  rowName:        { fontSize: 14, color: "#DEDEDE", fontFamily: "Inter_600SemiBold" },
  rowNamePlaying: { color: "#fff" },
  rowPlayingLabel: {
    fontSize: 9, color: RED, fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },

  // Delete
  deleteZone:   { width: 88, height: ITEM_H, paddingVertical: 10, paddingHorizontal: 8, justifyContent: "center", alignItems: "stretch" },
  deleteAction: { flex: 1, backgroundColor: RED, borderRadius: 10, alignItems: "center", justifyContent: "center" },

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

  // Modal / action sheet
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: "#222222",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: BORDER,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: "center",
    marginTop: 10, marginBottom: 16,
  },
  sheetTitle: {
    color: GREY, fontSize: 13, fontFamily: "Inter_400Regular",
    textAlign: "center", marginBottom: 12, paddingHorizontal: 20,
  },
  sheetOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  sheetIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(224,49,49,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  sheetOptionTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sheetOptionSub:   { color: GREY, fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  sheetDivider:     { height: 1, backgroundColor: BORDER, marginHorizontal: 20 },
  sheetCancel: {
    marginTop: 8, marginHorizontal: 16,
    backgroundColor: "#1A1A1A",
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 13, paddingVertical: 15, alignItems: "center",
  },
  sheetCancelText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // New playlist bottom sheet
  newPLSheet: {
    position: "absolute", left: 0, right: 0,
    backgroundColor: "#222222",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: BORDER,
    paddingBottom: 34,
  },
  newPLLabel: {
    color: "#ffffff", fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 1, textTransform: "uppercase",
    marginBottom: 8, paddingHorizontal: 20,
  },
  newPLInput: {
    color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold",
    paddingTop: 10, paddingBottom: 13, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 10,
    marginHorizontal: 20, marginBottom: 20,
  },
  newPLFooter: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  newPLCancel: {
    flex: 1, paddingVertical: 15, borderRadius: 13,
    backgroundColor: "#1A1A1A", alignItems: "center",
  },
  newPLCancelText: { color: "#ffffff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  newPLCreate: {
    flex: 2, paddingVertical: 15, borderRadius: 13,
    backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  newPLCreateText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
