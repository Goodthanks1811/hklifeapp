import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppleMusicPlayer } from "@/context/AppleMusicPlayerContext";
import { MusicSourceBus } from "@/utils/MusicSourceBus";

const RED    = "#E03131";
const BG     = "#111111";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

const PL_ITEM_H = 64;
const PL_ITEM_GAP = 4;
const PL_SLOT_H = PL_ITEM_H + PL_ITEM_GAP;

const ZERO_ANIM = new Animated.Value(0);
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

function applyOrder<T extends { id: string }>(items: T[], savedIds: string[]): T[] {
  if (!savedIds.length) return items;
  return [...items].sort((a, b) => {
    const ai = savedIds.indexOf(a.id);
    const bi = savedIds.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

type ApplePlaylist = { id: string; name: string; count: number };
type AppleSong     = { id: string; title: string; artist: string; albumTitle: string; duration: number };
type AuthStatus    = "authorized" | "denied" | "restricted" | "notDetermined" | "unavailable" | "loading";

let AppleMusicKit: any = null;
let _addPlayFailedListener: ((cb: (e: { reason: string; stateRaw: number }) => void) => { remove: () => void } | null) | null = null;
try {
  AppleMusicKit = require("apple-musickit");
  _addPlayFailedListener = AppleMusicKit?.addPlayFailedListener ?? null;
} catch {
  AppleMusicKit = null;
}

// ── Fuzzy match ───────────────────────────────────────────────────────────────
function fuzzyMatch(playlistName: string, filter: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
  const p = norm(playlistName);
  const f = norm(filter);
  if (!f) return false;
  if (p === f) return true;
  if (p.includes(f) || f.includes(p)) return true;
  const pWords = p.split(" ").filter(w => w.length > 1);
  const fWords = f.split(" ").filter(w => w.length > 1);
  if (!pWords.length || !fWords.length) return false;
  const shorter = pWords.length <= fWords.length ? pWords : fWords;
  const longer  = pWords.length <= fWords.length ? fWords : pWords;
  const matches = shorter.filter(w => longer.includes(w)).length;
  return matches / shorter.length >= 0.6;
}

// ── EQ bar ────────────────────────────────────────────────────────────────────
function EqBar({ index }: { index: number }) {
  const height = useRef(new Animated.Value(MIN_H)).current;
  useEffect(() => {
    const dur = 900 + index * 120;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(height, { toValue: MAX_H * BAR_HEIGHTS[index], duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(height, { toValue: MIN_H, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    const tid = setTimeout(() => anim.start(), BAR_DELAYS[index]);
    return () => { clearTimeout(tid); anim.stop(); };
  }, []);
  return <Animated.View style={[s.eqBar, { height }]} />;
}

// ── Format duration ───────────────────────────────────────────────────────────
function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const sec = Math.floor(secs % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Playlist row with expandable songs ────────────────────────────────────────
function PlaylistRow({
  pl,
  expanded,
  onToggle,
  isDragging,
  dimValue,
  onLongPress,
  playingPlaylistId,
  playingSongIndex,
  onPlaySong,
}: {
  pl: ApplePlaylist;
  expanded: boolean;
  onToggle: () => void;
  isDragging: boolean;
  dimValue: Animated.Value;
  onLongPress: () => void;
  playingPlaylistId: string | null;
  playingSongIndex: number | null;
  onPlaySong: (pl: ApplePlaylist, songIndex: number, songs: AppleSong[]) => void;
}) {
  const [songs, setSongs]               = useState<AppleSong[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const isThisPlaying = playingPlaylistId === pl.id;
  const opacity = dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] });

  // Fetch songs when expanded transitions to true
  useEffect(() => {
    if (expanded && songs.length === 0 && AppleMusicKit) {
      setLoadingSongs(true);
      AppleMusicKit.getSongsInPlaylist(pl.id)
        .then((result: AppleSong[]) => setSongs(result))
        .catch(() => setSongs([]))
        .finally(() => setLoadingSongs(false));
    }
  }, [expanded]);

  return (
    <Animated.View style={{ opacity }}>
      {/* Playlist header — its own standalone card */}
      <Pressable
        style={({ pressed }) => [s.card, isDragging && s.cardDragging, pressed && !isDragging && { opacity: 0.7 }]}
        onPress={() => { if (!isDragging) onToggle(); }}
        onLongPress={onLongPress}
        delayLongPress={250}
      >
        <View style={s.row}>
          <View style={[s.iconCell, isThisPlaying && s.iconCellPlaying]}>
            {isThisPlaying
              ? <Feather name="volume-2" size={18} color={RED} />
              : <Feather name="headphones" size={18} color={RED} />}
          </View>
          <View style={s.rowTextWrap}>
            <Text style={s.rowName}>{pl.name}</Text>
            {pl.count > 0 && (
              <Text style={s.rowCount}>{pl.count} song{pl.count !== 1 ? "s" : ""}</Text>
            )}
          </View>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="rgba(255,255,255,0.3)"
          />
        </View>
      </Pressable>

      {/* Expanded songs — each is its own standalone card, same style as My Music rows */}
      {expanded && !isDragging && (
        loadingSongs ? (
          <View style={s.songLoading}>
            <ActivityIndicator color={RED} size="small" />
          </View>
        ) : songs.length === 0 ? (
          <Text style={s.songEmpty}>No songs found</Text>
        ) : (
          songs.map((song, idx) => {
            const isActiveSong = isThisPlaying && playingSongIndex === idx;
            return (
              <Pressable
                key={song.id}
                style={({ pressed }) => [s.songRow, pressed && { opacity: 0.6 }]}
                onPress={() => onPlaySong(pl, idx, songs)}
              >
                <View style={s.songIndex}>
                  {isActiveSong
                    ? <Feather name="volume-2" size={14} color={RED} />
                    : <Text style={s.songIndexTx}>{idx + 1}</Text>}
                </View>
                <View style={s.songInfo}>
                  <Text style={[s.songTitle, isActiveSong && s.songTitleActive]} numberOfLines={1}>{song.title}</Text>
                  {song.artist ? (
                    <Text style={s.songArtist} numberOfLines={1}>{song.artist}</Text>
                  ) : null}
                </View>
                <Text style={s.songDuration}>{fmtDuration(song.duration)}</Text>
              </Pressable>
            );
          })
        )
      )}
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MusicAppleScreen() {
  const goBack = () => router.back();

  // ── Playlist filter management (long-press on EQ header) ─────────────────
  // Filter names are stored in AsyncStorage as a JSON array of strings.
  // fetchPlaylists() reads them and shows only matching playlists.
  const openFilterDialog = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const namesRaw = await AsyncStorage.getItem("music_apple_filter_names");
    const names: string[] = namesRaw ? JSON.parse(namesRaw) : [];
    const currentList = names.length > 0 ? `\nActive filters: ${names.join(", ")}` : "\nNo filters — showing all playlists.";
    Alert.alert(
      "Playlist Filters",
      `Long-press the EQ icon to add playlist name filters. Only playlists whose names match will be shown.${currentList}`,
      [
        {
          text: "Add Filter",
          onPress: () =>
            Alert.prompt(
              "Add Playlist Filter",
              "Type part of a playlist name to filter on:",
              async (name) => {
                if (!name?.trim()) return;
                const raw = await AsyncStorage.getItem("music_apple_filter_names");
                const cur: string[] = raw ? JSON.parse(raw) : [];
                if (!cur.includes(name.trim())) {
                  cur.push(name.trim());
                  await AsyncStorage.setItem("music_apple_filter_names", JSON.stringify(cur));
                  fetchPlaylists();
                }
              },
              "plain-text",
            ),
        },
        {
          text: names.length > 0 ? "Clear All Filters" : "Cancel",
          style: names.length > 0 ? "destructive" : "cancel",
          onPress: async () => {
            if (names.length === 0) return;
            await AsyncStorage.removeItem("music_apple_filter_names");
            fetchPlaylists();
          },
        },
        ...(names.length > 0 ? [{ text: "Cancel", style: "cancel" as const }] : []),
      ],
    );
  };
  const insets   = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;
  const am       = useAppleMusicPlayer();

  const [authStatus, setAuthStatus]   = useState<AuthStatus>("loading");
  const [playlists, setPlaylists]     = useState<ApplePlaylist[]>([]);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null);
  const [playingSongIndex, setPlayingSongIndex]   = useState<number | null>(null);
  const [loadingKey, setLoadingKey]               = useState<string | null>(null);

  // ── Expand/collapse state (controlled from outside PlaylistRow) ────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // ── Drag/reorder state ─────────────────────────────────────────────────────
  const [dragActiveIdx, setDragActiveIdx]       = useState(-1);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  const plPosAnims        = useRef<Record<string, Animated.Value>>({});
  const plAddedAnims      = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const containerRef      = useRef<View>(null);
  const containerTopRef   = useRef(0);
  const scrollOffsetRef   = useRef(0);
  const startScrollRef    = useRef(0);
  const isDraggingRef     = useRef(false);
  const draggingIdxRef    = useRef(-1);
  const hoverIdxRef       = useRef(-1);
  const dragOccurredRef   = useRef(false);
  const plPanY            = useRef(new Animated.Value(0)).current;
  const plDimAnim         = useRef(new Animated.Value(0)).current;
  const playlistsRef      = useRef<ApplePlaylist[]>([]);
  useEffect(() => { playlistsRef.current = playlists; }, [playlists]);

  playlists.forEach((pl, i) => {
    if (!plPosAnims.current[pl.id]) {
      plPosAnims.current[pl.id]   = new Animated.Value(i * PL_SLOT_H);
      plAddedAnims.current[pl.id] = Animated.add(plPosAnims.current[pl.id], plPanY);
    }
  });

  useEffect(() => {
    if (!isDraggingRef.current) {
      playlistsRef.current.forEach((pl, i) => plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H));
    }
  }, [playlists]);

  const animatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
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

  const startDrag = useCallback((idx: number) => {
    setExpandedIds(new Set()); // collapse all expanded before dragging
    isDraggingRef.current   = true;
    draggingIdxRef.current  = idx;
    hoverIdxRef.current     = idx;
    dragOccurredRef.current = true;
    setDragActiveIdx(idx);
    setListScrollEnabled(false);
    plPanY.setValue(0);
    Animated.timing(plDimAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startScrollRef.current = scrollOffsetRef.current;
    containerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      containerTopRef.current = py;
    });
  }, [plDimAnim]);

  const endDrag = useCallback(() => {
    const di = draggingIdxRef.current;
    const hi = hoverIdxRef.current;
    isDraggingRef.current  = false;
    draggingIdxRef.current = -1;
    hoverIdxRef.current    = -1;
    plPanY.setValue(0);
    setListScrollEnabled(true);
    Animated.timing(plDimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

    if (di >= 0 && hi >= 0 && di !== hi) {
      setPlaylists(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((pl, i) => plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H));
        playlistsRef.current = next;
        AsyncStorage.setItem("apple_playlist_order", JSON.stringify(next.map(p => p.id)));
        return next;
      });
    } else {
      playlistsRef.current.forEach((pl, i) => plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H));
    }
    setDragActiveIdx(-1);
    setTimeout(() => { dragOccurredRef.current = false; }, 80);
  }, [plDimAnim]);

  const dragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isDraggingRef.current) return;
      const di  = draggingIdxRef.current;
      const len = playlistsRef.current.length;
      plPanY.setValue(gs.dy);
      const relY     = gs.moveY - containerTopRef.current + (scrollOffsetRef.current - startScrollRef.current);
      const newHover = clamp(0, len - 1, Math.floor(relY / PL_SLOT_H));
      if (newHover !== hoverIdxRef.current) {
        hoverIdxRef.current = newHover;
        animatePositions(di, newHover);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderEnd:       () => endDrag(),
    onPanResponderTerminate: () => endDrag(),
  }), [animatePositions, endDrag]);

  // Sync from context (e.g. if user navigated away and came back)
  useEffect(() => {
    if (am.nowPlaying) {
      setPlayingPlaylistId(am.nowPlaying.playlistId);
      setPlayingSongIndex(am.nowPlaying.songIndex);
    }
  }, []);

  // Diagnostic: alert if play() succeeded but audio never started
  useEffect(() => {
    const sub = _addPlayFailedListener?.((e) => {
      Alert.alert("Apple Music Not Playing", e.reason);
    });
    return () => { sub?.remove(); };
  }, []);

  const fetchPlaylists = useCallback(async () => {
    setErrorMsg(null);
    if (!AppleMusicKit) { setAuthStatus("unavailable"); return; }
    try {
      const status: string = await AppleMusicKit.requestAuthorization();
      setAuthStatus(status as AuthStatus);
      if (status === "authorized") {
        const all: ApplePlaylist[] = await AppleMusicKit.getPlaylists();
        let filtered = all;
        const namesRaw = await AsyncStorage.getItem("music_apple_filter_names");
        if (namesRaw) {
          const names: string[] = JSON.parse(namesRaw);
          if (names.length > 0) {
            filtered = all.filter(p => names.some(n => fuzzyMatch(p.name, n)));
          }
        }
        const orderRaw = await AsyncStorage.getItem("apple_playlist_order");
        const ordered = orderRaw ? applyOrder(filtered, JSON.parse(orderRaw)) : filtered;
        setPlaylists(ordered);
      }
    } catch (e: any) {
      setAuthStatus("denied");
      setErrorMsg(e?.message ?? String(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchPlaylists(); }, [fetchPlaylists]));

  const handlePlaySong = async (pl: ApplePlaylist, songIndex: number, songs: AppleSong[]) => {
    if (!AppleMusicKit || loadingKey) return;
    const key = `${pl.id}:${songIndex}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingKey(key);
    // Open the full-screen player immediately — don't wait for the native play call
    const song = songs[songIndex];
    setPlayingPlaylistId(pl.id);
    setPlayingSongIndex(songIndex);
    am.setNowPlaying({
      playlistId: pl.id,
      playlistName: pl.name,
      songIndex,
      songs: songs.map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration })),
      title: song?.title ?? "",
      artist: song?.artist ?? "",
    });
    MusicSourceBus.triggerExpand();
    try {
      // 8-second timeout guards against prepareToPlay callback never firing.
      // Without it, loadingKey stays set and all subsequent song taps are blocked.
      await Promise.race([
        AppleMusicKit.playSongInPlaylist(pl.id, songIndex),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Apple Music didn't respond — please try again.")), 8000)
        ),
      ]);
    } catch (e: any) {
      Alert.alert("Apple Music Error", String(e?.message ?? e));
    } finally {
      setLoadingKey(null);
    }
  };

  const renderBody = () => {
    if (authStatus === "loading") {
      return (
        <View style={s.centred}>
          <ActivityIndicator color={RED} size="large" />
        </View>
      );
    }
    if (authStatus === "unavailable") {
      return (
        <View style={s.centred}>
          <Feather name="smartphone" size={44} color={RED} style={{ marginBottom: 16 }} />
          <Text style={s.stateTitle}>Install Required</Text>
          <Text style={s.stateBody}>Apple Music access is only available{"\n"}in the installed build, not Expo Go.</Text>
          {errorMsg ? <Text style={s.errorDetail}>{errorMsg}</Text> : null}
        </View>
      );
    }
    if (authStatus === "denied" || authStatus === "restricted") {
      return (
        <View style={s.centred}>
          <Feather name="lock" size={44} color={RED} style={{ marginBottom: 16 }} />
          <Text style={s.stateTitle}>Access Denied</Text>
          <Text style={s.stateBody}>Go to Settings → HK Life App{"\n"}and enable Media & Apple Music.</Text>
          {errorMsg ? <Text style={s.errorDetail}>{errorMsg}</Text> : null}
        </View>
      );
    }
    if (authStatus === "notDetermined") {
      return (
        <View style={s.centred}>
          <Pressable style={s.grantBtn} onPress={fetchPlaylists}>
            <Feather name="music" size={20} color="#fff" />
            <Text style={s.grantBtnText}>Grant Apple Music Access</Text>
          </Pressable>
        </View>
      );
    }
    if (playlists.length === 0) {
      return (
        <View style={s.centred}>
          <Text style={s.stateBody}>
            No playlists found.{"\n"}Check Settings → Music → Apple Music Playlists.
          </Text>
        </View>
      );
    }
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={listScrollEnabled}
        onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: am.nowPlaying ? 330 : 40, paddingHorizontal: 16 }}
      >
        <View
          ref={containerRef}
          {...dragResponder.panHandlers}
          style={dragActiveIdx !== -1
            ? { height: playlists.length * PL_SLOT_H }
            : undefined
          }
        >
          {dragActiveIdx !== -1 && (
            <Pressable
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
              onPress={() => endDrag()}
            />
          )}
          {playlists.map((pl, idx) => {
            const isDragging = dragActiveIdx === idx;
            if (dragActiveIdx !== -1) {
              // Drag mode: absolute-positioned fixed-height cards
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
                    pl={pl}
                    expanded={false}
                    onToggle={() => {}}
                    isDragging={isDragging}
                    dimValue={isDragging ? ZERO_ANIM : plDimAnim}
                    onLongPress={() => startDrag(idx)}
                    playingPlaylistId={playingPlaylistId}
                    playingSongIndex={playingSongIndex}
                    onPlaySong={handlePlaySong}
                  />
                </Animated.View>
              );
            }
            // Normal mode: in-flow, expandable
            return (
              <PlaylistRow
                key={pl.id}
                pl={pl}
                expanded={expandedIds.has(pl.id)}
                onToggle={() => { if (!dragOccurredRef.current) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleExpanded(pl.id); } }}
                isDragging={false}
                dimValue={ZERO_ANIM}
                onLongPress={() => startDrag(idx)}
                playingPlaylistId={playingPlaylistId}
                playingSongIndex={playingSongIndex}
                onPlaySong={handlePlaySong}
              />
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
        <View style={s.headerArea}>
          <Pressable style={s.eqWrap} onPress={goBack} onLongPress={openFilterDialog} delayLongPress={400}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => <EqBar key={i} index={i} />)}
          </Pressable>
          <Text style={s.pageTitle}>Apple Music</Text>
          <Pressable style={s.backZone} onPress={goBack} />
        </View>
        {renderBody()}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 800, alignSelf: "center", width: "100%" },

  headerArea: {
    backgroundColor: BG,
    paddingTop: 28, paddingBottom: 10,
    position: "relative",
  },
  backZone: { position: "absolute", left: 0, top: 0, bottom: 0, right: "50%" },

  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 62, paddingBottom: 4,
  },
  eqBar: { width: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },

  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    paddingTop: 8,
  },

  centred: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
  },
  stateTitle: {
    color: "#fff", fontSize: 17, fontWeight: "600",
    fontFamily: "Inter_600SemiBold", marginBottom: 10, textAlign: "center",
  },
  stateBody: {
    color: "rgba(255,255,255,0.45)", fontSize: 14,
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22,
  },
  errorDetail: {
    color: RED, fontSize: 11, fontFamily: "Inter_400Regular",
    textAlign: "center", marginTop: 12, paddingHorizontal: 16,
  },

  grantBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: RED, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
  },
  grantBtnText: {
    color: "#fff", fontSize: 15, fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  // Playlist header card
  card: {
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, marginBottom: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  cardDragging: {
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  iconCell: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#111",
    alignItems: "center", justifyContent: "center",
  },
  iconCellPlaying: { backgroundColor: "#111" },
  rowTextWrap: { flex: 1 },
  rowName: {
    fontSize: 15, fontWeight: "500", color: "#fff",
    fontFamily: "Inter_500Medium", textAlign: "center",
  },
  rowCount: {
    fontSize: 14, color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_600SemiBold", marginTop: 1, textAlign: "center",
  },

  // Song rows — standalone cards matching My Music track rows exactly
  songRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14, height: 62,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
    marginBottom: 8,
  },
  songLoading: { paddingVertical: 16, alignItems: "center" },
  songEmpty: { color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", paddingVertical: 12, fontFamily: "Inter_400Regular" },

  songIndex: { width: 22, alignItems: "center" },
  songIndexTx: { fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "Inter_400Regular" },

  songInfo: { flex: 1, minWidth: 0 },
  songTitle: { fontSize: 14, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
  songTitleActive: { color: RED },
  songArtist: { fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular", marginTop: 1 },
  songDuration: { fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular" },

});
