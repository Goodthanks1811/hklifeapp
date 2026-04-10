import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Modal,
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
  onPress,
  onRemove,
}: {
  track: MusicTrack;
  isActive: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  const renderRight = useCallback(() => (
    <Pressable
      style={styles.swipeDelete}
      onPress={onRemove}
    >
      <Text style={styles.swipeDeleteText}>Remove</Text>
    </Pressable>
  ), [onRemove]);

  return (
    <Swipeable renderRightActions={renderRight} overshootRight={false}>
      <Pressable onPress={onPress} style={styles.trackRow}>
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
  const isPickingRef                = useRef(false);
  const pickTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (isPickingRef.current) return;
    isPickingRef.current = true;
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
    finally { isPickingRef.current = false; }
  };

  const schedulePick = () => {
    if (pickTimerRef.current) clearTimeout(pickTimerRef.current);
    pickTimerRef.current = setTimeout(pickFiles, 600);
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
          <Pressable style={styles.emptyBtn} onPress={schedulePick}>
            <Text style={styles.emptyBtnText}>Add Songs</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: player.track ? 330 : 40,
            gap: ITEM_GAP,
          }}
          showsVerticalScrollIndicator={false}
        >
          {tracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              isActive={activeId === track.id}
              onPress={() => playFrom(idx)}
              onRemove={() => removeTrack(track.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* EQ/options popup */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
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
              onPress={() => { setShowMenu(false); schedulePick(); }}
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
  swipeDelete: {
    backgroundColor: RED,
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    height: ITEM_H,
    borderRadius: 14,
  },
  swipeDeleteText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  popupRowText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});
