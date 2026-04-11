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
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useMusicPlayer, MusicTrack } from "@/context/MusicPlayerContext";

const RED    = "#E03131";
const BG     = "#111111";
const ROW_BG = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#888";

const ITEM_H   = 52;
const ITEM_GAP = 8;
const SLOT_H   = ITEM_H + ITEM_GAP;

const ZERO_ANIM = new Animated.Value(0);
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H       = 42;
const MIN_H       = 5;

const TRACKS_KEY    = "mymusic_tracks_v2";
const PLAYLISTS_KEY = "mymusic_playlists_v1";
const MUSIC_DIR     = (FileSystem.documentDirectory ?? "") + "music/";

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
  if (!uri) return uri;
  if (uri.startsWith("file://") || uri.startsWith("/")) return uri;
  return (FileSystem.documentDirectory ?? "") + uri;
}

function EQBars({ playing, paused }: { playing: boolean; paused: boolean }) {
  const anims = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(MIN_H)));
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (playing && !paused) {
      loopsRef.current.forEach(l => l.stop());
      loopsRef.current = anims.current.map((a, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(a, {
              toValue: MAX_H * BAR_HEIGHTS[i],
              duration: 600,
              delay: BAR_DELAYS[i],
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
            Animated.timing(a, {
              toValue: MIN_H,
              duration: 600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
          ])
        )
      );
      loopsRef.current.forEach(l => l.start());
    } else {
      loopsRef.current.forEach(l => l.stop());
      anims.current.forEach(a =>
        Animated.timing(a, {
          toValue: MIN_H,
          duration: 200,
          useNativeDriver: false,
        }).start()
      );
    }
    return () => loopsRef.current.forEach(l => l.stop());
  }, [playing, paused]);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: MAX_H }}>
      {anims.current.map((a, i) => (
        <Animated.View
          key={i}
          style={{ width: 3, height: a, backgroundColor: RED, borderRadius: 1.5 }}
        />
      ))}
    </View>
  );
}

function TrackRow({
  track,
  isActive,
  isDragging,
  dimValue,
  onPress,
  onRemove,
  onLongPress,
}: {
  track: MusicTrack;
  isActive: boolean;
  isDragging: boolean;
  dimValue: Animated.Value;
  onPress: () => void;
  onRemove: () => void;
  onLongPress: () => void;
}) {
  const swipeRef    = useRef<Swipeable>(null);
  const revealedRef = useRef(false);
  const opacity     = dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] });

  const renderRight = useCallback(() => (
    <View style={styles.deleteZone}>
      <Pressable style={styles.deleteAction} onPress={onRemove}>
        <Feather name="trash-2" size={20} color="#fff" />
      </Pressable>
    </View>
  ), [onRemove]);

  return (
    <Animated.View style={{ opacity }}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRight}
        overshootRight={false}
        rightThreshold={28}
        friction={1.5}
        enabled={!isDragging}
        onSwipeableOpen={() => { revealedRef.current = true; }}
        onSwipeableClose={() => { revealedRef.current = false; }}
        containerStyle={{ borderRadius: 14, overflow: "hidden" }}
      >
        <Pressable
          onPress={() => revealedRef.current ? swipeRef.current?.close() : onPress()}
          onLongPress={() => { if (!revealedRef.current) onLongPress(); }}
          delayLongPress={200}
          style={[styles.trackRow, isDragging && styles.trackRowDragging]}
        >
          <View style={styles.trackIcon}>
            <Feather name="music" size={16} color={RED} />
          </View>
          <Text
            style={[styles.trackName, isActive && { color: RED }]}
            numberOfLines={1}
          >
            {track.name}
          </Text>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

export default function MusicPlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const player  = useMusicPlayer();

  const [playlist, setPlaylist]     = useState<Playlist | null>(null);
  const [tracks, setTracks]         = useState<MusicTrack[]>([]);
  const [showMenu, setShowMenu]     = useState(false);
  const playlistRef                 = useRef<Playlist | null>(null);
  const tracksRef                   = useRef<MusicTrack[]>([]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  // ── Drag/reorder ────────────────────────────────────────────────────────
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
  const [dragActiveIdx, setDragActiveIdx]       = useState(-1);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  tracks.forEach((t, i) => {
    if (!posAnims.current[t.id]) {
      posAnims.current[t.id]   = new Animated.Value(i * SLOT_H);
      addedAnims.current[t.id] = Animated.add(posAnims.current[t.id], panY);
    }
  });

  useEffect(() => {
    if (!isDraggingRef.current) {
      tracksRef.current.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
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
      const pl = playlistRef.current;
      if (pl) {
        const next = [...tracksRef.current];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
        tracksRef.current = next;
        setTracks(next);
        savePlaylists({ ...pl, tracks: next });
      }
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

  const activeId = player.track?.id
    ? toRel(player.track.id)
    : null;

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(PLAYLISTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Playlist[];
      const found  = parsed.find(p => p.id === id);
      if (!found) return;
      const pl = { ...found, tracks: found.tracks ?? [] };
      setPlaylist(pl);
      playlistRef.current = pl;
      setTracks(pl.tracks);
    })();
  }, [id]);

  const savePlaylists = async (updated: Playlist) => {
    const raw = await AsyncStorage.getItem(PLAYLISTS_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Playlist[];
    const next = all.map(p => p.id === updated.id ? updated : p);
    await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(next));
    playlistRef.current = updated;
    setPlaylist(updated);
    setTracks(updated.tracks);
  };

  const removeTrack = async (trackId: string) => {
    const pl = playlistRef.current;
    if (!pl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = { ...pl, tracks: pl.tracks.filter(t => t.id !== trackId) };
    await savePlaylists(updated);
  };

  const playFrom = (idx: number) => {
    const pl = playlistRef.current;
    if (!pl || !pl.tracks.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    player.playTrack(idx, pl.tracks.map(t => ({ ...t, uri: toAbs(t.uri) })));
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
        const fileName = asset.name ?? `track_${Date.now()}.mp3`;
        const destUri  = MUSIC_DIR + fileName;
        try {
          const info = await FileSystem.getInfoAsync(destUri);
          if (!info.exists) await FileSystem.copyAsync({ from: asset.uri, to: destUri });
          const displayName = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
          const relUri = toRel(destUri);
          newTracks.push({ id: relUri, name: displayName, uri: relUri });
        } catch (err) { console.warn("copy failed:", fileName, err); }
      }

      if (newTracks.length) {
        const pl = playlistRef.current;
        if (!pl) return;
        const existing = pl.tracks;
        const updated  = [...existing, ...newTracks.filter(t => !existing.find(x => x.id === t.id))];
        await savePlaylists({ ...pl, tracks: updated });
      }
    } catch (err) { console.warn("picker error:", err); }
  };

  if (!playlist) return <View style={styles.root} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="chevron-left" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{playlist.name}</Text>
        <Pressable
          onPress={() => { setShowMenu(true); }}
          style={styles.eqBtn}
          hitSlop={12}
        >
          <EQBars
            playing={!!player.track && player.track.uri !== undefined}
            paused={player.paused}
          />
        </Pressable>
      </View>

      {/* Track list */}
      {tracks.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="music" size={40} color={GREY} />
          <Text style={styles.emptyText}>No songs yet</Text>
          <Pressable style={styles.emptyBtn} onPress={pickFiles}>
            <Text style={styles.emptyBtnText}>Add Songs</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          scrollEnabled={listScrollEnabled}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: player.track ? 330 : 40,
          }}
          onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View
            ref={containerRef}
            {...dragResponder.panHandlers}
            style={{ height: tracks.length * SLOT_H }}
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
                  style={{ position: "absolute", left: 0, right: 0, height: ITEM_H, top: 0, zIndex: isDragging ? 100 : 1, transform: [{ translateY }] }}
                >
                  <TrackRow
                    track={track}
                    isActive={activeId === track.id}
                    isDragging={isDragging}
                    dimValue={isDragging ? ZERO_ANIM : dimAnim}
                    onPress={() => { if (!dragOccurredRef.current) playFrom(idx); }}
                    onRemove={() => removeTrack(track.id)}
                    onLongPress={() => startDrag(idx)}
                  />
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* EQ/options popup */}
      <Modal
        visible={showMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.popupOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.popupCard}>
            <Text style={styles.popupTitle}>{playlist.name}</Text>

            <Pressable
              style={styles.popupRow}
              onPress={() => {
                setShowMenu(false);
                if (tracks.length > 0) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  player.playTrack(0, tracks.map(t => ({ ...t, uri: toAbs(t.uri) })));
                }
              }}
            >
              <Feather name="play" size={18} color="#fff" />
              <Text style={styles.popupRowText}>Play All</Text>
            </Pressable>

            <View style={styles.popupDivider} />

            <Pressable
              style={styles.popupRow}
              onPress={async () => { setShowMenu(false); await pickFiles(); }}
            >
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.popupRowText}>Add Songs</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  eqBtn: {
    paddingLeft: 12,
    height: MAX_H,
    justifyContent: "flex-end",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ROW_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    height: ITEM_H,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  trackRowDragging: {
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  trackIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: ROW_BG,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  trackName: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  deleteZone: {
    width: 88, height: ITEM_H,
    paddingVertical: 10, paddingHorizontal: 8,
    justifyContent: "center", alignItems: "stretch",
  },
  deleteAction: {
    flex: 1, backgroundColor: RED,
    borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    color: GREY,
    fontSize: 16,
    fontWeight: "500",
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: RED,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  popupCard: {
    backgroundColor: "#000",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
  },
  popupTitle: {
    color: GREY,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 12,
    letterSpacing: 0.3,
  },
  popupDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },
  popupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  popupRowText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
});
