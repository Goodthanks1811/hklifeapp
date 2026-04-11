import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
import { Audio } from "expo-av";
import { useMusicPlayer, MusicTrack } from "@/context/MusicPlayerContext";

const RED    = "#E03131";
const BG     = "#111111";
const ROW_BG = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#888";

const ITEM_H    = 52;
const ITEM_GAP  = 8;
const SLOT_H    = ITEM_H + ITEM_GAP;
const PL_ITEM_H = 62;
const PL_SLOT_H = PL_ITEM_H + ITEM_GAP;

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H       = 42;
const MIN_H       = 5;


const TRACKS_KEY   = "mymusic_tracks_v2";
const PLAYLISTS_KEY = "mymusic_playlists_v1";
const MUSIC_DIR    = (FileSystem.documentDirectory ?? "") + "music/";

type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  tracks: MusicTrack[];
  trackIds?: string[];
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

// ── Playlist row ──────────────────────────────────────────────────────────────
function PlaylistRow({
  playlist, trackCount, isDragging, dimValue, onPress, onLongPress, onMenuPress,
}: {
  playlist: Playlist; trackCount: number;
  isDragging: boolean; dimValue: Animated.Value;
  onPress: () => void; onLongPress: () => void; onMenuPress: () => void;
}) {
  const opacity = dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] });
  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={250}
        style={({ pressed }) => [st.plRow, isDragging && st.plRowDragging, pressed && !isDragging && { opacity: 0.75 }]}
      >
        <View style={st.plRowIcon}>
          <Feather name="headphones" size={16} color={RED} />
        </View>
        <View style={st.plRowMid}>
          <Text style={st.plRowName} numberOfLines={1}>{playlist.name}</Text>
          <Text style={st.plRowCount}>{trackCount === 0 ? "No songs" : `${trackCount} song${trackCount === 1 ? "" : "s"}`}</Text>
        </View>
        <Pressable
          onPress={e => { e.stopPropagation(); onMenuPress(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 4 }}
        >
          <Feather name="more-horizontal" size={16} color="#555" />
        </Pressable>
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
          <View style={[st.rowIcon, isActive && st.rowIconActive]}>
            <Feather name={isActive && isPlaying ? "volume-2" : "music"} size={16} color={RED} />
          </View>
          <Text style={[st.rowName, isActive && st.rowNamePlaying]} numberOfLines={1}>
            {track.name}
          </Text>
          {track.duration != null && (
            <Text style={st.rowDuration}>{fmtMs(track.duration)}</Text>
          )}
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

function PlTrackRow({ track, isActive, isPlaying, isDragging, dimValue, onPlay, onDelete, onLongPress }: {
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

  const renderRight = useCallback(() => (
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
        renderRightActions={renderRight}
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
          <View style={[st.rowIcon, isActive && st.rowIconActive]}>
            <Feather name={isActive && isPlaying ? "volume-2" : "music"} size={16} color={RED} />
          </View>
          <Text style={[st.rowName, isActive && st.rowNamePlaying]} numberOfLines={1}>
            {track.name}
          </Text>
          {track.duration != null && (
            <Text style={st.rowDuration}>{fmtMs(track.duration)}</Text>
          )}
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
  const insets            = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const isTablet          = screenW >= 768;
  const player   = useMusicPlayer();

  // ── In-screen playlist navigation ────────────────────────────────────────
  const [selPlId, setSelPlId]   = useState<string | null>(null);
  const selPlIdRef              = useRef<string | null>(null);
  const slideAnim               = useRef(new Animated.Value(0)).current;
  const mainSlide               = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -screenW] });
  const plSlide                 = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [screenW, 0] });

  const openPlaylist = (id: string) => {
    selPlIdRef.current = id;
    setSelPlId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(slideAnim, { toValue: 1, friction: 20, tension: 200, useNativeDriver: true }).start();
  };

  const closePlaylist = () => {
    Animated.spring(slideAnim, { toValue: 0, friction: 20, tension: 200, useNativeDriver: true }).start(() => {
      selPlIdRef.current = null;
      setSelPlId(null);
    });
  };

  const goBack = () => {
    if (selPlIdRef.current) { closePlaylist(); return; }
    router.back();
  };

  // ── Tracks ────────────────────────────────────────────────────────────────
  const [isLoaded, setIsLoaded] = useState(false);
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
  const shakeAnim                         = useRef(new Animated.Value(0)).current;

  // Keyboard shift for new playlist popup (shift card up so input stays visible)
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", e => {
      Animated.timing(keyboardOffset, {
        toValue: -(e.endCoordinates.height / 2),
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    const hide = Keyboard.addListener("keyboardWillHide", e => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 200,
        useNativeDriver: true,
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
        let globalTracks = tracksRef.current;
        let needsSave = false;
        const migrated: Playlist[] = parsed.map(pl => {
          if (!pl.tracks && pl.trackIds?.length) {
            const resolved = pl.trackIds
              .map(id => globalTracks.find(t => t.id === id))
              .filter(Boolean) as MusicTrack[];
            if (resolved.length) {
              const migratedIds = new Set(resolved.map(t => t.id));
              globalTracks = globalTracks.filter(t => !migratedIds.has(t.id));
              needsSave = true;
            }
            return { ...pl, tracks: resolved, trackIds: undefined };
          }
          return { ...pl, tracks: pl.tracks ?? [] };
        });
        if (needsSave) {
          tracksRef.current = globalTracks;
          setTracks(globalTracks);
          await AsyncStorage.setItem(TRACKS_KEY, JSON.stringify(globalTracks));
        }
        playlistsRef.current = migrated;
        setPlaylists(migrated);
        await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(migrated));
      }
      setIsLoaded(true);
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
  const shakeCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const createPlaylist = async () => {
    const name = newPLName.trim();
    if (!name) { shakeCard(); return; }
    Keyboard.dismiss();
    const pl: Playlist = { id: `pl_${Date.now()}`, name, createdAt: Date.now(), tracks: [] };
    await savePlaylists([...playlistsRef.current, pl]);
    setShowNewPL(false);
    setNewPLName("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deletePlaylist = async (id: string) => {
    await savePlaylists(playlistsRef.current.filter(p => p.id !== id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removeFromPlaylist = async (plId: string, trackId: string) => {
    await savePlaylists(playlistsRef.current.map(p =>
      p.id === plId ? { ...p, tracks: (p.tracks ?? []).filter(t => t.id !== trackId) } : p
    ));
  };

  const playPlaylist = (playlist: Playlist) => {
    const pts = (playlist.tracks ?? []).filter(Boolean);
    if (!pts.length) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    player.playTrack(0, pts.map(t => ({ ...t, uri: toAbs(t.uri) })));
  };

  // ── File picker (library + optional playlist target) ───────────────────────
  const pickFiles = async (targetPlaylistId?: string) => {
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
        const fileName = asset.name ?? `track_${Date.now()}.mp3`;
        const destUri  = MUSIC_DIR + fileName;
        try {
          const info = await FileSystem.getInfoAsync(destUri);
          if (!info.exists) await FileSystem.copyAsync({ from: asset.uri, to: destUri });
          const displayName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
          const relUri = toRel(destUri);
          let durMs: number | undefined;
          try {
            const { sound, status } = await Audio.Sound.createAsync({ uri: toAbs(relUri) }, undefined, null, false);
            if (status.isLoaded) durMs = status.durationMillis ?? undefined;
            await sound.unloadAsync();
          } catch {}
          newTracks.push({ id: relUri, name: displayName, uri: relUri, duration: durMs });
        } catch (err) { console.warn("copy failed:", fileName, err); }
      }

      if (newTracks.length) {
        if (targetPlaylistId) {
          const pls = playlistsRef.current;
          const pl  = pls.find(p => p.id === targetPlaylistId);
          if (pl) {
            const existing = pl.tracks ?? [];
            const updated  = [...existing, ...newTracks.filter(t => !existing.find(x => x.id === t.id))];
            await savePlaylists(pls.map(p => p.id === targetPlaylistId ? { ...p, tracks: updated } : p));
          }
        } else {
          const cur    = tracksRef.current;
          const merged = [...cur, ...newTracks.filter(t => !cur.find(x => x.id === t.id))];
          await saveTracks(merged);
        }
      }
    } catch (err) { console.warn("picker error:", err); }
  };

  const handleDelete = async (idx: number) => {
    const list  = tracksRef.current;
    const track = list[idx];
    try { await FileSystem.deleteAsync(toAbs(track.uri), { idempotent: true }); } catch {}
    // Also remove from all playlists
    const updatedPls = playlistsRef.current.map(p => ({
      ...p, trackIds: p.trackIds?.filter(id => id !== track.id),
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

  // ── Playlist-section drag/reorder ──────────────────────────────────────────
  const plPosAnims        = useRef<Record<string, Animated.Value>>({});
  const plAddedAnims      = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const plContainerRef    = useRef<View>(null);
  const plContainerTopRef = useRef(0);
  const plIsDraggingRef   = useRef(false);
  const plDraggingIdxRef  = useRef(-1);
  const plHoverIdxRef     = useRef(-1);
  const plDragOccurredRef = useRef(false);
  const plPanY            = useRef(new Animated.Value(0)).current;
  const plDimAnim         = useRef(new Animated.Value(0)).current;
  const [plDragActiveIdx, setPlDragActiveIdx] = useState(-1);

  playlists.forEach((pl, i) => {
    if (!plPosAnims.current[pl.id]) {
      plPosAnims.current[pl.id]   = new Animated.Value(i * PL_SLOT_H);
      plAddedAnims.current[pl.id] = Animated.add(plPosAnims.current[pl.id], plPanY);
    }
  });

  useEffect(() => {
    if (!plIsDraggingRef.current) {
      playlistsRef.current.forEach((pl, i) => {
        plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H);
      });
    }
  }, [playlists]);

  const plAnimatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const cur = playlistsRef.current;
    cur.forEach((pl, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      plPosAnims.current[pl.id]?.stopAnimation();
      Animated.timing(plPosAnims.current[pl.id], {
        toValue: target * PL_SLOT_H, duration: 110, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    });
  }, []);

  const plStartDrag = useCallback((idx: number) => {
    plIsDraggingRef.current   = true;
    plDraggingIdxRef.current  = idx;
    plHoverIdxRef.current     = idx;
    plDragOccurredRef.current = true;
    setPlDragActiveIdx(idx);
    setListScrollEnabled(false);
    plPanY.setValue(0);
    Animated.timing(plDimAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    plContainerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      plContainerTopRef.current = py;
    });
  }, [plDimAnim]);

  const plEndDrag = useCallback(() => {
    const di = plDraggingIdxRef.current;
    const hi = plHoverIdxRef.current;
    plIsDraggingRef.current  = false;
    plDraggingIdxRef.current = -1;
    plHoverIdxRef.current    = -1;
    plPanY.setValue(0);
    setListScrollEnabled(true);
    Animated.timing(plDimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

    if (di >= 0 && hi >= 0 && di !== hi) {
      savePlaylists((() => {
        const next = [...playlistsRef.current];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((pl, i) => plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H));
        return next;
      })());
    } else {
      playlistsRef.current.forEach((pl, i) => plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H));
    }
    setPlDragActiveIdx(-1);
    setTimeout(() => { plDragOccurredRef.current = false; }, 80);
  }, []);

  const plDragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => plIsDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!plIsDraggingRef.current) return;
      const di  = plDraggingIdxRef.current;
      const len = playlistsRef.current.length;
      plPanY.setValue(gs.dy);
      const relY     = gs.moveY - plContainerTopRef.current;
      const newHover = clamp(0, len - 1, Math.floor(relY / PL_SLOT_H));
      if (newHover !== plHoverIdxRef.current) {
        plHoverIdxRef.current = newHover;
        plAnimatePositions(di, newHover);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderEnd:       () => plEndDrag(),
    onPanResponderTerminate: () => plEndDrag(),
  }), [plAnimatePositions, plEndDrag]);

  // ── Playlist-detail track drag/reorder ────────────────────────────────────
  const pdPosAnims        = useRef<Record<string, Animated.Value>>({});
  const pdAddedAnims      = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const pdContainerRef    = useRef<View>(null);
  const pdContainerTopRef = useRef(0);
  const pdScrollOffsetRef = useRef(0);
  const pdStartScrollRef  = useRef(0);
  const pdIsDraggingRef   = useRef(false);
  const pdDraggingIdxRef  = useRef(-1);
  const pdHoverIdxRef     = useRef(-1);
  const pdDragOccurredRef = useRef(false);
  const pdPanY            = useRef(new Animated.Value(0)).current;
  const pdDimAnim         = useRef(new Animated.Value(0)).current;
  const [pdDragActiveIdx, setPdDragActiveIdx] = useState(-1);
  const [pdScrollEnabled, setPdScrollEnabled] = useState(true);

  const selPlTracks = selPlId ? (playlists.find(p => p.id === selPlId)?.tracks ?? []) : [];

  selPlTracks.forEach((t, i) => {
    if (!pdPosAnims.current[t.id]) {
      pdPosAnims.current[t.id]   = new Animated.Value(i * SLOT_H);
      pdAddedAnims.current[t.id] = Animated.add(pdPosAnims.current[t.id], pdPanY);
    }
  });

  useEffect(() => {
    if (!pdIsDraggingRef.current) {
      selPlTracks.forEach((t, i) => pdPosAnims.current[t.id]?.setValue(i * SLOT_H));
    }
  }, [selPlId, selPlTracks.length]);

  const pdAnimatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const plId = selPlIdRef.current;
    const cur  = plId ? (playlistsRef.current.find(p => p.id === plId)?.tracks ?? []) : [];
    cur.forEach((t, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      pdPosAnims.current[t.id]?.stopAnimation();
      Animated.timing(pdPosAnims.current[t.id], {
        toValue: target * SLOT_H, duration: 110, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    });
  }, []);

  const pdStartDrag = useCallback((idx: number) => {
    pdIsDraggingRef.current   = true;
    pdDraggingIdxRef.current  = idx;
    pdHoverIdxRef.current     = idx;
    pdDragOccurredRef.current = true;
    setPdDragActiveIdx(idx);
    setPdScrollEnabled(false);
    pdPanY.setValue(0);
    Animated.timing(pdDimAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    pdStartScrollRef.current = pdScrollOffsetRef.current;
    pdContainerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      pdContainerTopRef.current = py;
    });
  }, [pdDimAnim]);

  const pdEndDrag = useCallback(() => {
    const di    = pdDraggingIdxRef.current;
    const hi    = pdHoverIdxRef.current;
    const plId  = selPlIdRef.current;
    pdIsDraggingRef.current  = false;
    pdDraggingIdxRef.current = -1;
    pdHoverIdxRef.current    = -1;
    pdPanY.setValue(0);
    setPdScrollEnabled(true);
    Animated.timing(pdDimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

    if (di >= 0 && hi >= 0 && di !== hi && plId) {
      const pls   = playlistsRef.current;
      const pl    = pls.find(p => p.id === plId);
      if (pl) {
        const next = [...(pl.tracks ?? [])];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((t, i) => pdPosAnims.current[t.id]?.setValue(i * SLOT_H));
        savePlaylists(pls.map(p => p.id === plId ? { ...p, tracks: next } : p));
      }
    } else {
      const plId2 = selPlIdRef.current;
      const pl    = plId2 ? playlistsRef.current.find(p => p.id === plId2) : null;
      (pl?.tracks ?? []).forEach((t, i) => pdPosAnims.current[t.id]?.setValue(i * SLOT_H));
    }
    setPdDragActiveIdx(-1);
    setTimeout(() => { pdDragOccurredRef.current = false; }, 80);
  }, []);

  const pdDragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => pdIsDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!pdIsDraggingRef.current) return;
      const di    = pdDraggingIdxRef.current;
      const plId  = selPlIdRef.current;
      const cur   = plId ? (playlistsRef.current.find(p => p.id === plId)?.tracks ?? []) : [];
      const len   = cur.length;
      pdPanY.setValue(gs.dy);
      const relY     = gs.moveY - pdContainerTopRef.current + (pdScrollOffsetRef.current - pdStartScrollRef.current);
      const newHover = clamp(0, len - 1, Math.floor(relY / SLOT_H));
      if (newHover !== pdHoverIdxRef.current) {
        pdHoverIdxRef.current = newHover;
        pdAnimatePositions(di, newHover);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderEnd:       () => pdEndDrag(),
    onPanResponderTerminate: () => pdEndDrag(),
  }), [pdAnimatePositions, pdEndDrag]);

  const isEmpty = isLoaded && tracks.length === 0 && playlists.length === 0;
  const selPl   = selPlId ? (playlists.find(p => p.id === selPlId) ?? null) : null;

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={[st.inner, isTablet && st.innerTablet]}>

        {/* Header */}
        <View style={st.headerArea}>
          {/* Single pressable wraps EQ bars + title so the whole zone long-presses to the menu */}
          <Pressable
            style={st.headerLongPressZone}
            onPress={goBack}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowEQMenu(true);
            }}
            delayLongPress={400}
          >
            <View style={st.eqWrap}>
              {Array.from({ length: BAR_COUNT }).map((_, i) => <EqBar key={i} index={i} />)}
            </View>
            <Text style={st.pageTitle}>My Music</Text>
          </Pressable>
          <Animated.Text style={[st.plSubtitle, { opacity: slideAnim }]} numberOfLines={1}>
            {selPl?.name ?? ""}
          </Animated.Text>
          <Pressable style={st.backZone} onPress={goBack} />
        </View>

        {/* Sliding content container */}
        <View style={{ flex: 1, overflow: "hidden" }}>

          {/* ── Main list — slides left when playlist opens ── */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: mainSlide }] }]}>
            {isEmpty ? (
              <Pressable
                style={st.emptyState}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowEQMenu(true);
                }}
                delayLongPress={400}
              >
                <Feather name="music" size={44} color="rgba(255,255,255,0.1)" />
                <Text style={st.emptyTitle}>No tracks yet</Text>
                <Text style={st.emptySubtitle}>Long press anywhere here to add music or create a playlist</Text>
                <Pressable style={st.emptyBtn} onPress={() => pickFiles()}>
                  <Feather name="plus" size={15} color="#fff" />
                  <Text style={st.emptyBtnText}>Add Music</Text>
                </Pressable>
              </Pressable>
            ) : (
              <ScrollView
                style={st.list}
                scrollEnabled={listScrollEnabled}
                showsVerticalScrollIndicator={false}
                onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: player.track ? 330 : 40 }}
              >
                {/* ── Playlists section ─────────────────────────────── */}
                {playlists.length > 0 && (
                  <View style={[st.section, { marginHorizontal: 16 }]}>
                    <View
                      ref={plContainerRef}
                      {...plDragResponder.panHandlers}
                      style={{ height: playlists.length * PL_SLOT_H }}
                    >
                      {plDragActiveIdx !== -1 && (
                        <Pressable
                          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                          onPress={() => plEndDrag()}
                        />
                      )}
                      {playlists.map((pl, idx) => {
                        const count      = (pl.tracks ?? []).length;
                        const isDragging = plDragActiveIdx === idx;
                        const posAnim    = plPosAnims.current[pl.id] ?? new Animated.Value(idx * PL_SLOT_H);
                        const translateY = isDragging
                          ? (plAddedAnims.current[pl.id] ?? posAnim)
                          : posAnim;
                        return (
                          <Animated.View
                            key={pl.id}
                            style={{ position: "absolute", left: 0, right: 0, height: PL_ITEM_H, top: 0, zIndex: isDragging ? 100 : 1, transform: [{ translateY }] }}
                          >
                            <PlaylistRow
                              playlist={pl}
                              trackCount={count}
                              isDragging={isDragging}
                              dimValue={isDragging ? ZERO_ANIM : plDimAnim}
                              onPress={() => { if (!plDragOccurredRef.current) openPlaylist(pl.id); }}
                              onLongPress={() => plStartDrag(idx)}
                              onMenuPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setPlMenuId(pl.id);
                              }}
                            />
                          </Animated.View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* ── Songs section ─────────────────────────────────── */}
                {tracks.length > 0 && (
                  <View style={st.section}>
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
          </Animated.View>

          {/* ── Playlist detail — slides in from right ── */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: plSlide }] }]}>
            {selPl && (
              <>
                {(selPl.tracks ?? []).length === 0 ? (
                  <View style={st.emptyState}>
                    <Feather name="music" size={44} color="rgba(255,255,255,0.1)" />
                    <Text style={st.emptyTitle}>No tracks yet</Text>
                    <Pressable style={st.emptyBtn} onPress={() => pickFiles(selPl.id)}>
                      <Feather name="plus" size={15} color="#fff" />
                      <Text style={st.emptyBtnText}>Add Songs</Text>
                    </Pressable>
                  </View>
                ) : (
                  <ScrollView
                    style={st.list}
                    scrollEnabled={pdScrollEnabled}
                    showsVerticalScrollIndicator={false}
                    onScroll={e => { pdScrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: player.track ? 330 : 40, paddingHorizontal: 16 }}
                  >
                    <View
                      ref={pdContainerRef}
                      {...pdDragResponder.panHandlers}
                      style={{ height: (selPl.tracks ?? []).length * SLOT_H }}
                    >
                      {pdDragActiveIdx !== -1 && (
                        <Pressable
                          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                          onPress={() => pdEndDrag()}
                        />
                      )}
                      {(selPl.tracks ?? []).map((track, idx) => {
                        const isDragging = pdDragActiveIdx === idx;
                        const posAnim    = pdPosAnims.current[track.id] ?? new Animated.Value(idx * SLOT_H);
                        const translateY = isDragging
                          ? (pdAddedAnims.current[track.id] ?? posAnim)
                          : posAnim;
                        return (
                          <Animated.View
                            key={track.id}
                            style={[st.absItem, { top: 0, zIndex: isDragging ? 100 : 1, transform: [{ translateY }] }]}
                          >
                            <PlTrackRow
                              track={track}
                              isActive={player.track?.id === track.id}
                              isPlaying={player.isPlaying}
                              isDragging={isDragging}
                              dimValue={isDragging ? ZERO_ANIM : pdDimAnim}
                              onPlay={() => {
                                if (pdDragOccurredRef.current) return;
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                player.playTrack(idx, (selPl.tracks ?? []).map(t => ({ ...t, uri: toAbs(t.uri) })));
                              }}
                              onDelete={() => removeFromPlaylist(selPl.id, track.id)}
                              onLongPress={() => pdStartDrag(idx)}
                            />
                          </Animated.View>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </Animated.View>

        </View>
      </View>

      {/* ── EQ long-press menu ────────────────────────────────────────────── */}
      <Modal
        visible={showEQMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowEQMenu(false)}
      >
        <Pressable style={st.popupOverlay} onPress={() => setShowEQMenu(false)}>
          <Pressable onPress={() => {}}>
            <View style={st.popupCard}>
              <Pressable
                style={st.menuRow}
                onPress={async () => { setShowEQMenu(false); await pickFiles(); }}
              >
                <Feather name="music" size={18} color={RED} />
                <Text style={st.menuRowText}>Add Songs</Text>
              </Pressable>

              <View style={st.menuDivider} />

              <Pressable
                style={st.menuRow}
                onPress={() => { setShowEQMenu(false); setTimeout(() => { setShowNewPL(true); setTimeout(() => newPLInputRef.current?.focus(), 100); }, 300); }}
              >
                <Feather name="folder-plus" size={18} color={RED} />
                <Text style={st.menuRowText}>New Playlist</Text>
              </Pressable>

              <View style={[st.menuDivider, { marginTop: 4 }]} />

              <Pressable style={st.menuCancel} onPress={() => setShowEQMenu(false)}>
                <Text style={st.menuCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Playlist long-press menu ──────────────────────────────────────── */}
      <Modal
        visible={plMenuId !== null}
        transparent
        animationType="none"
        onRequestClose={() => setPlMenuId(null)}
      >
        <Pressable style={st.popupOverlay} onPress={() => setPlMenuId(null)}>
          <Pressable onPress={() => {}}>
            <View style={st.popupCard}>
              <Text style={st.popupTitle}>
                {playlists.find(p => p.id === plMenuId)?.name ?? ""}
              </Text>

              <Pressable
                style={st.menuRow}
                onPress={async () => {
                  const id = plMenuId;
                  setPlMenuId(null);
                  await pickFiles(id ?? undefined);
                }}
              >
                <Feather name="plus-circle" size={18} color={RED} />
                <Text style={st.menuRowText}>Add Songs</Text>
              </Pressable>

              <View style={st.menuDivider} />

              <Pressable
                style={st.menuRow}
                onPress={() => {
                  const id = plMenuId;
                  setPlMenuId(null);
                  if (id) deletePlaylist(id);
                }}
              >
                <Feather name="trash-2" size={18} color={RED} />
                <Text style={[st.menuRowText, { color: RED }]}>Delete Playlist</Text>
              </Pressable>

              <View style={[st.menuDivider, { marginTop: 4 }]} />

              <Pressable style={st.menuCancel} onPress={() => setPlMenuId(null)}>
                <Text style={st.menuCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── New Playlist centered popup ───────────────────────────────────── */}
      <Modal
        visible={showNewPL}
        transparent
        animationType="fade"
        onRequestClose={() => { Keyboard.dismiss(); setShowNewPL(false); setNewPLName(""); }}
      >
        <Pressable
          style={st.popupOverlay}
          onPress={() => { Keyboard.dismiss(); setShowNewPL(false); setNewPLName(""); }}
        >
          <Animated.View
            style={[st.popupCard, { transform: [{ translateY: keyboardOffset }, { translateX: shakeAnim }] }]}
          >
            <Pressable onPress={() => {}}>
              <Text style={st.popupTitle}>New Playlist</Text>
              <TextInput
                ref={newPLInputRef}
                style={st.popupInput}
                placeholder="Playlist name"
                placeholderTextColor="#555"
                value={newPLName}
                onChangeText={setNewPLName}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={createPlaylist}
                maxLength={60}
                keyboardAppearance="dark"
                selectionColor={RED}
              />
              <View style={st.popupFooter}>
                <Pressable
                  style={st.popupCancel}
                  onPress={() => { Keyboard.dismiss(); setShowNewPL(false); setNewPLName(""); }}
                >
                  <Text style={st.popupCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={st.popupCreate}
                  onPress={createPlaylist}
                >
                  <Text style={st.popupCreateText}>Create  →</Text>
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
    backgroundColor: BG, paddingTop: 48, paddingBottom: 4,
    alignItems: "center", position: "relative",
  },
  headerLongPressZone: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingBottom: 24,
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
    paddingTop: 8, paddingBottom: 2,
  },

  list: { flex: 1 },

  // Section layout
  section:       { marginBottom: 8 },
  sectionHeader: {
    color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold",
    marginHorizontal: 16, marginBottom: 12, marginTop: 4,
  },

  // Playlist name subtitle in header
  plSubtitle: {
    color: RED, fontSize: 14, fontFamily: "Inter_600SemiBold",
    textAlign: "center", marginTop: 0, paddingBottom: 6,
  },

  // Playlist rows
  plRow: {
    height: PL_ITEM_H, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  plRowDragging: {
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  plRowIcon: { width: 32, alignItems: "center" },
  plRowMid:  { flex: 1 },
  plRowName: { fontSize: 15, color: "#fff", fontFamily: "Inter_600SemiBold" },
  plRowCount: { fontSize: 12, color: GREY, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Track list — exact original
  absItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },
  row: {
    height: ITEM_H,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  rowActive:   {},
  rowDragging: {
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: ROW_BG,
    alignItems: "center", justifyContent: "center",
  },
  rowIconActive:  {},
  rowName:        { flex: 1, fontSize: 14, color: "#fff", fontFamily: "Inter_500Medium" },
  rowNamePlaying: { color: RED },
  rowDuration:    { fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular" },

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

  // Popup menu rows (shared by EQ menu + playlist menu)
  menuRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14,
    paddingVertical: 15,
  },
  menuRowText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  menuDivider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },
  menuCancel: {
    paddingVertical: 15, alignItems: "center",
  },
  menuCancelText: { color: GREY, fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // New playlist centered popup
  popupOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center", paddingHorizontal: 52,
  },
  popupCard: {
    backgroundColor: "#000",
    borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    paddingTop: 24, paddingHorizontal: 20, paddingBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6, shadowRadius: 24, elevation: 24,
  },
  popupTitle: {
    color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold",
    textAlign: "center", marginBottom: 18,
  },
  popupInput: {
    color: "#fff", fontSize: 15, fontFamily: "Inter_500Medium",
    paddingVertical: 13, paddingHorizontal: 14,
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    marginBottom: 20,
  },
  popupFooter: { flexDirection: "row", gap: 10 },
  popupCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 13,
    backgroundColor: "#141414",
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center",
  },
  popupCancelText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  popupCreate: {
    flex: 2, paddingVertical: 14, borderRadius: 13,
    backgroundColor: RED, alignItems: "center",
  },
  popupCreateText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
