import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppleMusicPlayer } from "@/context/AppleMusicPlayerContext";

const SILVER = "rgba(255,255,255,0.72)";
const BG     = "#111111";
const ROW    = "#0f0f0f";
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
const MAX_H = 42;
const MIN_H = 5;

const ZERO_ANIM = new Animated.Value(0);
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

type ApplePlaylist = { id: string; name: string; count: number };
type AppleSong     = { id: string; title: string; artist: string; albumTitle: string; duration: number };
type AuthStatus    = "authorized" | "denied" | "restricted" | "notDetermined" | "unavailable" | "loading";

let AppleMusicKit: any = null;
try { AppleMusicKit = require("apple-musickit"); } catch { AppleMusicKit = null; }

// ── Fuzzy match ───────────────────────────────────────────────────────────────
function fuzzyMatch(playlistName: string, filter: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
  const p = norm(playlistName);
  const f = norm(filter);
  if (!f) return false;
  if (p === f || p.includes(f) || f.includes(p)) return true;
  const pWords = p.split(" ").filter(w => w.length > 1);
  const fWords = f.split(" ").filter(w => w.length > 1);
  if (!pWords.length || !fWords.length) return false;
  const shorter = pWords.length <= fWords.length ? pWords : fWords;
  const longer  = pWords.length <= fWords.length ? fWords : pWords;
  return shorter.filter(w => longer.includes(w)).length / shorter.length >= 0.6;
}

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

function fmtSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const sec = Math.floor(secs % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Playlist row ──────────────────────────────────────────────────────────────
function PlaylistRow({ pl, isPlaying, isDragging, dimValue, onPress, onLongPress }: {
  pl: ApplePlaylist; isPlaying: boolean;
  isDragging: boolean; dimValue: Animated.Value;
  onPress: () => void; onLongPress: () => void;
}) {
  const opacity = dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] });
  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={250}
        style={({ pressed }) => [s.plRow, isDragging && s.plRowDragging, pressed && !isDragging && { opacity: 0.75 }]}
      >
        <View style={s.plRowIcon}>
          <Feather name={isPlaying ? "volume-2" : "headphones"} size={16} color={SILVER} />
        </View>
        <View style={s.plRowMid}>
          <Text style={s.plRowName} numberOfLines={1}>{pl.name}</Text>
          {pl.count > 0 && (
            <Text style={s.plRowCount}>{pl.count} song{pl.count !== 1 ? "s" : ""}</Text>
          )}
        </View>
        <Feather name="menu" size={15} color="#444" />
      </Pressable>
    </Animated.View>
  );
}

// ── Song row ──────────────────────────────────────────────────────────────────
function SongRow({ song, idx, plId, isActive, loadingKey, isDragging, dimValue, onPlay, onLongPress }: {
  song: AppleSong; idx: number; plId: string;
  isActive: boolean; loadingKey: string | null;
  isDragging: boolean; dimValue: Animated.Value;
  onPlay: () => void; onLongPress: () => void;
}) {
  const loading = loadingKey === `${plId}:${idx}`;
  const opacity = dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] });
  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        onPress={onPlay}
        onLongPress={onLongPress}
        delayLongPress={250}
        style={({ pressed }) => [s.songRow, isDragging && s.songRowDragging, pressed && !isDragging && { opacity: 0.75 }]}
      >
        <View style={s.songIcon}>
          {loading
            ? <ActivityIndicator size="small" color={SILVER} />
            : <Feather
                name={isActive ? "volume-2" : "music"}
                size={16}
                color={isActive ? SILVER : "rgba(255,255,255,0.25)"}
              />}
        </View>
        <View style={s.songInfo}>
          <Text style={[s.songTitle, isActive && s.songTitleActive]} numberOfLines={1}>{song.title}</Text>
          {song.artist ? <Text style={s.songArtist} numberOfLines={1}>{song.artist}</Text> : null}
        </View>
        {song.duration > 0 && <Text style={s.songDuration}>{fmtSecs(song.duration)}</Text>}
        <Feather name="menu" size={14} color="#333" style={{ marginLeft: 6 }} />
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MusicAppleScreen() {
  const insets             = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const isTablet           = screenW >= 768;
  const am                 = useAppleMusicPlayer();

  // ── In-screen playlist navigation ─────────────────────────────────────────
  const [selPl, setSelPl]       = useState<ApplePlaylist | null>(null);
  const selPlRef                = useRef<ApplePlaylist | null>(null);
  const slideAnim               = useRef(new Animated.Value(0)).current;
  const mainSlide               = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -screenW] });
  const plSlide                 = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [screenW, 0] });

  const [selPlSongs, setSelPlSongs]       = useState<AppleSong[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const songsCacheRef                     = useRef<Record<string, AppleSong[]>>({});

  const openPlaylist = useCallback(async (pl: ApplePlaylist) => {
    selPlRef.current = pl;
    setSelPl(pl);
    // Reset song drag anims for new playlist
    soPosAnims.current  = {};
    soAddedAnims.current = {};
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(slideAnim, { toValue: 1, friction: 20, tension: 200, useNativeDriver: true }).start();
    if (songsCacheRef.current[pl.id]) {
      setSelPlSongs(songsCacheRef.current[pl.id]);
      return;
    }
    setLoadingTracks(true);
    setSelPlSongs([]);
    try {
      const result: AppleSong[] = AppleMusicKit ? await AppleMusicKit.getSongsInPlaylist(pl.id) : [];
      const savedRaw = await AsyncStorage.getItem(`apple_song_order_${pl.id}`);
      const ordered = savedRaw ? applyOrder(result, JSON.parse(savedRaw)) : result;
      songsCacheRef.current[pl.id] = ordered;
      setSelPlSongs(ordered);
    } catch { setSelPlSongs([]); }
    finally { setLoadingTracks(false); }
  }, [slideAnim]);

  const closePlaylist = useCallback(() => {
    Animated.spring(slideAnim, { toValue: 0, friction: 20, tension: 200, useNativeDriver: true }).start(() => {
      selPlRef.current = null;
      setSelPl(null);
      setSelPlSongs([]);
    });
  }, [slideAnim]);

  const goBack = () => {
    if (selPlRef.current) { closePlaylist(); return; }
    router.back();
  };

  // ── Auth & playlists ───────────────────────────────────────────────────────
  const [authStatus,        setAuthStatus]        = useState<AuthStatus>("loading");
  const [playlists,         setPlaylists]         = useState<ApplePlaylist[]>([]);
  const [errorMsg,          setErrorMsg]          = useState<string | null>(null);
  const [loadingKey,        setLoadingKey]        = useState<string | null>(null);
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null);
  const [playingSongIndex,  setPlayingSongIndex]  = useState<number | null>(null);

  useEffect(() => {
    if (am.nowPlaying) {
      setPlayingPlaylistId(am.nowPlaying.playlistId);
      setPlayingSongIndex(am.nowPlaying.songIndex);
    }
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
    } catch (e: any) { setAuthStatus("denied"); setErrorMsg(e?.message ?? String(e)); }
  }, []);

  useFocusEffect(useCallback(() => { fetchPlaylists(); }, [fetchPlaylists]));

  const handlePlaySong = async (pl: ApplePlaylist, songIndex: number, songs: AppleSong[]) => {
    if (!AppleMusicKit || loadingKey) return;
    const key = `${pl.id}:${songIndex}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingKey(key);
    const song = songs[songIndex];
    setPlayingPlaylistId(pl.id);
    setPlayingSongIndex(songIndex);
    am.setNowPlaying({
      playlistId: pl.id, playlistName: pl.name, songIndex,
      songs: songs.map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration })),
      title: song?.title ?? "", artist: song?.artist ?? "",
    });
    try { await AppleMusicKit.playSongInPlaylist(pl.id, songIndex); } catch {}
    finally { setLoadingKey(null); }
  };

  // ── Playlist drag/reorder ──────────────────────────────────────────────────
  const plPosAnims        = useRef<Record<string, Animated.Value>>({});
  const plAddedAnims      = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const plContainerRef    = useRef<View>(null);
  const plContainerTopRef = useRef(0);
  const plScrollOffsetRef = useRef(0);
  const plStartScrollRef  = useRef(0);
  const plIsDraggingRef   = useRef(false);
  const plDraggingIdxRef  = useRef(-1);
  const plHoverIdxRef     = useRef(-1);
  const plDragOccurredRef = useRef(false);
  const plPanY            = useRef(new Animated.Value(0)).current;
  const plDimAnim         = useRef(new Animated.Value(0)).current;
  const [plDragActiveIdx, setPlDragActiveIdx] = useState(-1);
  const [plScrollEnabled, setPlScrollEnabled] = useState(true);
  const plPlaylistsRef    = useRef<ApplePlaylist[]>([]);
  useEffect(() => { plPlaylistsRef.current = playlists; }, [playlists]);

  playlists.forEach((pl, i) => {
    if (!plPosAnims.current[pl.id]) {
      plPosAnims.current[pl.id]   = new Animated.Value(i * PL_SLOT_H);
      plAddedAnims.current[pl.id] = Animated.add(plPosAnims.current[pl.id], plPanY);
    }
  });

  useEffect(() => {
    if (!plIsDraggingRef.current) {
      plPlaylistsRef.current.forEach((pl, i) => {
        plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H);
      });
    }
  }, [playlists]);

  const plAnimatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const cur = plPlaylistsRef.current;
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
    setPlScrollEnabled(false);
    plPanY.setValue(0);
    Animated.timing(plDimAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    plStartScrollRef.current = plScrollOffsetRef.current;
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
    setPlScrollEnabled(true);
    Animated.timing(plDimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

    if (di >= 0 && hi >= 0 && di !== hi) {
      setPlaylists(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((pl, i) => plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H));
        plPlaylistsRef.current = next;
        AsyncStorage.setItem("apple_playlist_order", JSON.stringify(next.map(p => p.id)));
        return next;
      });
    } else {
      plPlaylistsRef.current.forEach((pl, i) => plPosAnims.current[pl.id]?.setValue(i * PL_SLOT_H));
    }
    setPlDragActiveIdx(-1);
    setTimeout(() => { plDragOccurredRef.current = false; }, 80);
  }, []);

  const plDragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => plIsDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!plIsDraggingRef.current) return;
      const di  = plDraggingIdxRef.current;
      const len = plPlaylistsRef.current.length;
      plPanY.setValue(gs.dy);
      const relY     = gs.moveY - plContainerTopRef.current + (plScrollOffsetRef.current - plStartScrollRef.current);
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

  // ── Song drag/reorder ──────────────────────────────────────────────────────
  const soPosAnims        = useRef<Record<string, Animated.Value>>({});
  const soAddedAnims      = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const soContainerRef    = useRef<View>(null);
  const soContainerTopRef = useRef(0);
  const soScrollOffsetRef = useRef(0);
  const soStartScrollRef  = useRef(0);
  const soIsDraggingRef   = useRef(false);
  const soDraggingIdxRef  = useRef(-1);
  const soHoverIdxRef     = useRef(-1);
  const soDragOccurredRef = useRef(false);
  const soPanY            = useRef(new Animated.Value(0)).current;
  const soDimAnim         = useRef(new Animated.Value(0)).current;
  const [soDragActiveIdx, setSoDragActiveIdx] = useState(-1);
  const [soScrollEnabled, setSoScrollEnabled] = useState(true);
  const soSongsRef        = useRef<AppleSong[]>([]);
  useEffect(() => { soSongsRef.current = selPlSongs; }, [selPlSongs]);

  selPlSongs.forEach((song, i) => {
    if (!soPosAnims.current[song.id]) {
      soPosAnims.current[song.id]   = new Animated.Value(i * SLOT_H);
      soAddedAnims.current[song.id] = Animated.add(soPosAnims.current[song.id], soPanY);
    }
  });

  useEffect(() => {
    if (!soIsDraggingRef.current) {
      soSongsRef.current.forEach((song, i) => {
        soPosAnims.current[song.id]?.setValue(i * SLOT_H);
      });
    }
  }, [selPlSongs]);

  const soAnimatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const cur = soSongsRef.current;
    cur.forEach((song, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      soPosAnims.current[song.id]?.stopAnimation();
      Animated.timing(soPosAnims.current[song.id], {
        toValue: target * SLOT_H, duration: 110, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    });
  }, []);

  const soStartDrag = useCallback((idx: number) => {
    soIsDraggingRef.current   = true;
    soDraggingIdxRef.current  = idx;
    soHoverIdxRef.current     = idx;
    soDragOccurredRef.current = true;
    setSoDragActiveIdx(idx);
    setSoScrollEnabled(false);
    soPanY.setValue(0);
    Animated.timing(soDimAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    soStartScrollRef.current = soScrollOffsetRef.current;
    soContainerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      soContainerTopRef.current = py;
    });
  }, [soDimAnim]);

  const soEndDrag = useCallback(() => {
    const di = soDraggingIdxRef.current;
    const hi = soHoverIdxRef.current;
    soIsDraggingRef.current  = false;
    soDraggingIdxRef.current = -1;
    soHoverIdxRef.current    = -1;
    soPanY.setValue(0);
    setSoScrollEnabled(true);
    Animated.timing(soDimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

    if (di >= 0 && hi >= 0 && di !== hi) {
      setSelPlSongs(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((song, i) => soPosAnims.current[song.id]?.setValue(i * SLOT_H));
        soSongsRef.current = next;
        const plId = selPlRef.current?.id;
        if (plId) {
          songsCacheRef.current[plId] = next;
          AsyncStorage.setItem(`apple_song_order_${plId}`, JSON.stringify(next.map(s => s.id)));
        }
        return next;
      });
    } else {
      soSongsRef.current.forEach((song, i) => soPosAnims.current[song.id]?.setValue(i * SLOT_H));
    }
    setSoDragActiveIdx(-1);
    setTimeout(() => { soDragOccurredRef.current = false; }, 80);
  }, []);

  const soDragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => soIsDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!soIsDraggingRef.current) return;
      const di  = soDraggingIdxRef.current;
      const len = soSongsRef.current.length;
      soPanY.setValue(gs.dy);
      const relY     = gs.moveY - soContainerTopRef.current + (soScrollOffsetRef.current - soStartScrollRef.current);
      const newHover = clamp(0, len - 1, Math.floor(relY / SLOT_H));
      if (newHover !== soHoverIdxRef.current) {
        soHoverIdxRef.current = newHover;
        soAnimatePositions(di, newHover);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderEnd:       () => soEndDrag(),
    onPanResponderTerminate: () => soEndDrag(),
  }), [soAnimatePositions, soEndDrag]);

  // ── Auth state body ────────────────────────────────────────────────────────
  const renderBody = () => {
    if (authStatus === "loading") {
      return <View style={s.centred}><ActivityIndicator color={SILVER} size="large" /></View>;
    }
    if (authStatus === "unavailable") {
      return (
        <View style={s.centred}>
          <Feather name="smartphone" size={44} color={SILVER} style={{ marginBottom: 16 }} />
          <Text style={s.stateTitle}>Install Required</Text>
          <Text style={s.stateBody}>Apple Music access is only available{"\n"}in the installed build, not Expo Go.</Text>
          {errorMsg ? <Text style={s.errorDetail}>{errorMsg}</Text> : null}
        </View>
      );
    }
    if (authStatus === "denied" || authStatus === "restricted") {
      return (
        <View style={s.centred}>
          <Feather name="lock" size={44} color={SILVER} style={{ marginBottom: 16 }} />
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
          <Text style={s.stateBody}>No playlists found.{"\n"}Check Settings → Music → Apple Music Playlists.</Text>
        </View>
      );
    }
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={plScrollEnabled}
        onScroll={e => { plScrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: am.nowPlaying ? 330 : 40, paddingHorizontal: 16 }}
      >
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
                  pl={pl}
                  isPlaying={playingPlaylistId === pl.id}
                  isDragging={isDragging}
                  dimValue={isDragging ? ZERO_ANIM : plDimAnim}
                  onPress={() => { if (!plDragOccurredRef.current) openPlaylist(pl); }}
                  onLongPress={() => plStartDrag(idx)}
                />
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>

        {/* Header */}
        <View style={s.headerArea}>
          <Pressable
            style={s.eqWrap}
            onPress={goBack}
            hitSlop={{ top: 20, bottom: 20, left: 40, right: 40 }}
          >
            {Array.from({ length: BAR_COUNT }).map((_, i) => <EqBar key={i} index={i} />)}
          </Pressable>
          <Text style={s.pageTitle}>Apple Music</Text>
          <Animated.Text style={[s.plSubtitle, { opacity: slideAnim }]} numberOfLines={1}>
            {selPl?.name ?? ""}
          </Animated.Text>
          <Pressable style={s.backZone} onPress={goBack} />
        </View>

        {/* Sliding content */}
        <View style={{ flex: 1, overflow: "hidden" }}>

          {/* Main playlist list */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: mainSlide }] }]}>
            {renderBody()}
          </Animated.View>

          {/* Playlist detail */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: plSlide }] }]}>
            {selPl && (
              loadingTracks ? (
                <View style={s.centred}>
                  <ActivityIndicator color={SILVER} size="large" />
                </View>
              ) : selPlSongs.length === 0 ? (
                <View style={s.centred}>
                  <Text style={s.stateBody}>No songs found</Text>
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={soScrollEnabled}
                  onScroll={e => { soScrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
                  scrollEventThrottle={16}
                  contentContainerStyle={{ paddingTop: 8, paddingBottom: am.nowPlaying ? 330 : 40, paddingHorizontal: 16 }}
                >
                  <View
                    ref={soContainerRef}
                    {...soDragResponder.panHandlers}
                    style={{ height: selPlSongs.length * SLOT_H }}
                  >
                    {soDragActiveIdx !== -1 && (
                      <Pressable
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                        onPress={() => soEndDrag()}
                      />
                    )}
                    {selPlSongs.map((song, idx) => {
                      const isDragging = soDragActiveIdx === idx;
                      const posAnim    = soPosAnims.current[song.id] ?? new Animated.Value(idx * SLOT_H);
                      const translateY = isDragging
                        ? (soAddedAnims.current[song.id] ?? posAnim)
                        : posAnim;
                      return (
                        <Animated.View
                          key={song.id}
                          style={{ position: "absolute", left: 0, right: 0, height: ITEM_H, top: 0, zIndex: isDragging ? 100 : 1, transform: [{ translateY }] }}
                        >
                          <SongRow
                            song={song}
                            idx={idx}
                            plId={selPl.id}
                            isActive={playingPlaylistId === selPl.id && playingSongIndex === idx}
                            loadingKey={loadingKey}
                            isDragging={isDragging}
                            dimValue={isDragging ? ZERO_ANIM : soDimAnim}
                            onPlay={() => { if (!soDragOccurredRef.current) handlePlaySong(selPl, idx, selPlSongs); }}
                            onLongPress={() => soStartDrag(idx)}
                          />
                        </Animated.View>
                      );
                    })}
                  </View>
                </ScrollView>
              )
            )}
          </Animated.View>

        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 800, alignSelf: "center", width: "100%" },

  headerArea: {
    backgroundColor: BG, paddingTop: 48, paddingBottom: 4,
    alignItems: "center", position: "relative",
  },
  backZone: { position: "absolute", left: 0, top: 0, bottom: 0, right: "50%" },

  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 62, paddingBottom: 4,
  },
  eqBar: { width: 5, borderRadius: 3, backgroundColor: SILVER },

  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontFamily: "Inter_600SemiBold",
    paddingTop: 8, paddingBottom: 2,
  },
  plSubtitle: {
    color: SILVER, fontSize: 14, fontFamily: "Inter_600SemiBold",
    textAlign: "center", marginTop: 0, paddingBottom: 6,
  },

  centred: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },

  stateTitle: {
    color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold",
    marginBottom: 10, textAlign: "center",
  },
  stateBody: {
    color: "rgba(255,255,255,0.45)", fontSize: 14,
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22,
  },
  errorDetail: {
    color: SILVER, fontSize: 11, fontFamily: "Inter_400Regular",
    textAlign: "center", marginTop: 12, paddingHorizontal: 16,
  },
  grantBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  grantBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Playlist rows
  plRow: {
    height: PL_ITEM_H, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  plRowDragging: {
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  plRowIcon:  { width: 32, alignItems: "center" },
  plRowMid:   { flex: 1 },
  plRowName:  { fontSize: 15, color: "#fff", fontFamily: "Inter_600SemiBold" },
  plRowCount: { fontSize: 12, color: GREY, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Song rows
  songRow: {
    height: ITEM_H, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  songRowDragging: {
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  songIcon:        { width: 28, alignItems: "center" },
  songInfo:        { flex: 1, minWidth: 0 },
  songTitle:       { fontSize: 14, color: "#fff", fontFamily: "Inter_500Medium" },
  songTitleActive: { color: SILVER },
  songArtist:      { fontSize: 12, color: GREY, fontFamily: "Inter_400Regular", marginTop: 1 },
  songDuration:    { fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular" },
});
