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
import { useSpotifyPlayer, ensureRemoteConnected, disconnectRemote } from "@/context/SpotifyPlayerContext";
import { getUserPlaylists, getPlaylist, getPlaylistTracks, extractPlaylistId, SpotifyPlaylist, SpotifyTrack } from "@/utils/SpotifyAPI";
import { getStoredTokens, clearStoredTokens, authenticateSpotify } from "@/utils/SpotifyAuth";

const GREEN  = "#1DB954";
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

let SpotifyRemote: any = null;
try { SpotifyRemote = require("react-native-spotify-remote").SpotifyRemote; } catch {}

// ── EQ bar ────────────────────────────────────────────────────────────────────
function EqBar({ index }: { index: number }) {
  const height = useRef(new Animated.Value(MIN_H)).current;
  useEffect(() => {
    const dur  = 900 + index * 120;
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

function fmtMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// ── Playlist row ──────────────────────────────────────────────────────────────
function PlaylistRow({ pl, isPlaying, isDragging, dimValue, onPress, onLongPress }: {
  pl: SpotifyPlaylist; isPlaying: boolean;
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
          <Feather name={isPlaying ? "volume-2" : "headphones"} size={16} color={GREEN} />
        </View>
        <View style={s.plRowMid}>
          <Text style={s.plRowName} numberOfLines={1}>{pl.name}</Text>
          {pl.trackCount > 0 && (
            <Text style={s.plRowCount}>{pl.trackCount} song{pl.trackCount !== 1 ? "s" : ""}</Text>
          )}
        </View>
        <Feather name="menu" size={15} color="#444" />
      </Pressable>
    </Animated.View>
  );
}

// ── Song row ──────────────────────────────────────────────────────────────────
function SongRow({ song, idx, plId, isActive, loadingKey, isDragging, dimValue, onPlay, onLongPress }: {
  song: SpotifyTrack; idx: number; plId: string;
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
            ? <ActivityIndicator size="small" color={GREEN} />
            : <Feather
                name={isActive ? "volume-2" : "music"}
                size={16}
                color={isActive ? GREEN : "rgba(255,255,255,0.25)"}
              />}
        </View>
        <View style={s.songInfo}>
          <Text style={[s.songTitle, isActive && s.songTitleActive]} numberOfLines={1}>{song.title}</Text>
          {song.artist ? <Text style={s.songArtist} numberOfLines={1}>{song.artist}</Text> : null}
        </View>
        {song.durationMs > 0 && <Text style={s.songDuration}>{fmtMs(song.durationMs)}</Text>}
        <Feather name="menu" size={14} color="#333" style={{ marginLeft: 6 }} />
      </Pressable>
    </Animated.View>
  );
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MusicSpotifyScreen() {
  const insets              = useSafeAreaInsets();
  const { width: screenW }  = useWindowDimensions();
  const isTablet            = screenW >= 768;
  const sp                  = useSpotifyPlayer();

  // ── In-screen playlist navigation ─────────────────────────────────────────
  const [selPl, setSelPl]       = useState<SpotifyPlaylist | null>(null);
  const selPlRef                = useRef<SpotifyPlaylist | null>(null);
  const slideAnim               = useRef(new Animated.Value(0)).current;
  const mainSlide               = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -screenW] });
  const plSlide                 = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [screenW, 0] });

  const [selPlSongs, setSelPlSongs]       = useState<SpotifyTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [trackError,   setTrackError]     = useState<string | null>(null);
  const songsCacheRef                     = useRef<Record<string, SpotifyTrack[]>>({});

  const openPlaylist = useCallback(async (pl: SpotifyPlaylist) => {
    selPlRef.current = pl;
    setSelPl(pl);
    setTrackError(null);
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
      const result = await getPlaylistTracks(pl.id);
      const savedRaw = await AsyncStorage.getItem(`spotify_song_order_${pl.id}`);
      const ordered = savedRaw ? applyOrder(result, JSON.parse(savedRaw)) : result;
      songsCacheRef.current[pl.id] = ordered;
      setSelPlSongs(ordered);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setTrackError(msg);
      setSelPlSongs([]);
    }
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
  const [authStatus,        setAuthStatus]        = useState<"loading" | "connected" | "disconnected">("loading");
  const [connecting,        setConnecting]        = useState(false);
  const [playlists,         setPlaylists]         = useState<SpotifyPlaylist[]>([]);
  const [loadingPlaylists,  setLoadingPlaylists]  = useState(true);
  const [errorMsg,          setErrorMsg]          = useState<string | null>(null);
  const [is403,             setIs403]             = useState(false);
  const [loadingKey,        setLoadingKey]        = useState<string | null>(null);
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null);
  const [playingSongIndex,  setPlayingSongIndex]  = useState<number | null>(null);

  useEffect(() => {
    if (sp.nowPlaying) {
      setPlayingPlaylistId(sp.nowPlaying.playlistId);
      setPlayingSongIndex(sp.nowPlaying.songIndex);
    }
  }, []);

  const loadPlaylists = useCallback(async (showSpinner = true) => {
    setErrorMsg(null);
    setIs403(false);
    if (showSpinner) setLoadingPlaylists(true);
    try {
      const tokens = await getStoredTokens();
      if (!tokens) { setAuthStatus("disconnected"); setLoadingPlaylists(false); return; }
      setAuthStatus("connected");

      const savedRaw = await AsyncStorage.getItem("music_spotify_playlists");
      let results: SpotifyPlaylist[] = [];
      if (savedRaw) {
        const saved: { name: string; url: string }[] = JSON.parse(savedRaw);
        const savedIds: string[] = saved
          .map(pl => extractPlaylistId(pl.url))
          .filter(Boolean) as string[];
        if (savedIds.length > 0) {
          results = (await Promise.all(savedIds.map(id => getPlaylist(id)))).filter(Boolean) as SpotifyPlaylist[];
        }
      }
      if (!results.length) {
        results = await getUserPlaylists();
      }

      const orderRaw = await AsyncStorage.getItem("spotify_playlist_order");
      const ordered = orderRaw ? applyOrder(results, JSON.parse(orderRaw)) : results;
      setPlaylists(ordered);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg === "not_authenticated") setAuthStatus("disconnected");
      else if (msg.includes("403")) { setIs403(true); setErrorMsg(msg); }
      else setErrorMsg(msg);
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadPlaylists(playlists.length === 0);
  }, [loadPlaylists, playlists.length]));

  const handleConnect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true); setErrorMsg(null);
    try {
      const result = await authenticateSpotify();
      if (result.type === "success") await loadPlaylists();
      else if (result.type === "error") setErrorMsg(result.error);
    } catch (e: any) { setErrorMsg(e?.message ?? String(e)); }
    finally { setConnecting(false); }
  }, [connecting, loadPlaylists]);

  const handleDisconnect = useCallback(async () => {
    await disconnectRemote();
    await clearStoredTokens();
    sp.setNowPlaying(null);
    setPlaylists([]); setPlayingPlaylistId(null); setPlayingSongIndex(null);
    setAuthStatus("disconnected");
  }, [sp]);

  const handlePlaySong = useCallback(async (pl: SpotifyPlaylist, songIndex: number, songs: SpotifyTrack[]) => {
    if (loadingKey) return;
    const key  = `${pl.id}:${songIndex}`;
    const song = songs[songIndex];
    if (!song) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingKey(key);
    setPlayingPlaylistId(pl.id);
    setPlayingSongIndex(songIndex);
    sp.setNowPlaying({ playlistId: pl.id, playlistName: pl.name, songIndex, songs, title: song.title, artist: song.artist });
    if (SpotifyRemote && song.uri) {
      try {
        const connected = await ensureRemoteConnected();
        if (connected) await SpotifyRemote.playUri(song.uri);
      } catch (err) { console.warn("[SpotifyRemote] playUri:", err); }
    }
    setLoadingKey(null);
  }, [loadingKey, sp]);

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
  const plPlaylistsRef    = useRef<SpotifyPlaylist[]>([]);
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
        AsyncStorage.setItem("spotify_playlist_order", JSON.stringify(next.map(p => p.id)));
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
  const soSongsRef        = useRef<SpotifyTrack[]>([]);
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
          AsyncStorage.setItem(`spotify_song_order_${plId}`, JSON.stringify(next.map(s => s.id)));
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

  // ── Auth state body (shown in main panel) ─────────────────────────────────
  const renderBody = () => {
    if (authStatus === "loading" || (authStatus === "connected" && loadingPlaylists)) {
      return <View style={s.centred}><ActivityIndicator color={GREEN} size="large" /></View>;
    }
    if (authStatus === "disconnected") {
      return (
        <View style={s.centred}>
          <Feather name="music" size={52} color={GREEN} style={{ marginBottom: 24 }} />
          <Text style={s.stateTitle}>Connect Spotify</Text>
          <Text style={s.stateBody}>Sign in with your Spotify account to access{"\n"}your playlists and control playback.</Text>
          {errorMsg ? <Text style={s.errorDetail}>{errorMsg}</Text> : null}
          <Pressable style={({ pressed }) => [s.connectBtn, pressed && { opacity: 0.8 }]} onPress={handleConnect} disabled={connecting}>
            {connecting
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Feather name="log-in" size={18} color="#fff" /><Text style={s.connectBtnText}>Connect Spotify</Text></>}
          </Pressable>
        </View>
      );
    }
    if (playlists.length === 0) {
      if (is403) {
        return (
          <View style={s.centred}>
            <Text style={s.fourOhThreeTitle}>Access Restricted</Text>
            <Text style={s.fourOhThreeBody}>
              Spotify returned a <Text style={{ color: GREEN, fontFamily: "Inter_600SemiBold" }}>403 Forbidden</Text> error.{"\n\n"}
              Your account is added to the dashboard — try <Text style={{ color: GREEN, fontFamily: "Inter_600SemiBold" }}>Reconnecting Spotify</Text> to refresh your access token with the latest permissions.
            </Text>
            <Pressable
              style={({ pressed }) => [s.connectBtn, { marginTop: 20 }, pressed && { opacity: 0.8 }]}
              onPress={handleDisconnect}
            >
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={s.connectBtnText}>Reconnect Spotify</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.retryBtn, { marginTop: 12 }, pressed && { opacity: 0.75 }]}
              onPress={loadPlaylists}
            >
              <Feather name="refresh-cw" size={13} color={GREEN} />
              <Text style={s.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        );
      }
      return (
        <View style={s.centred}>
          <Text style={s.stateBody}>No playlists found.{"\n"}Check Settings → Music → Spotify Playlists.</Text>
          {errorMsg ? <Text style={s.errorDetail}>{errorMsg}</Text> : null}
          <Pressable
            style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.75 }]}
            onPress={loadPlaylists}
          >
            <Feather name="refresh-cw" size={13} color={GREEN} />
            <Text style={s.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={plScrollEnabled}
        onScroll={e => { plScrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: sp.nowPlaying ? 330 : 40, paddingHorizontal: 16 }}
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
          <Text style={s.pageTitle}>Spotify</Text>
          <Animated.Text style={[s.plSubtitle, { opacity: slideAnim }]} numberOfLines={1}>
            {selPl?.name ?? ""}
          </Animated.Text>
          <Pressable style={s.backZone} onPress={goBack} />
          {authStatus === "connected" && (
            <Pressable style={s.disconnectBtn} onPress={handleDisconnect}>
              <Feather name="log-out" size={15} color="rgba(255,255,255,0.35)" />
            </Pressable>
          )}
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
                  <ActivityIndicator color={GREEN} size="large" />
                </View>
              ) : selPlSongs.length === 0 ? (
                <View style={s.centred}>
                  {trackError === "not_authenticated" ? (
                    <>
                      <Feather name="alert-circle" size={36} color={GREEN} style={{ marginBottom: 16 }} />
                      <Text style={s.fourOhThreeTitle}>Session Expired</Text>
                      <Text style={s.stateBody}>Your Spotify session has expired.{"\n"}Tap below to reconnect.</Text>
                      <Pressable
                        style={({ pressed }) => [s.connectBtn, { marginTop: 24 }, pressed && { opacity: 0.8 }]}
                        onPress={() => { closePlaylist(); setTimeout(handleConnect, 400); }}
                      >
                        <Feather name="log-in" size={18} color="#fff" />
                        <Text style={s.connectBtnText}>Reconnect Spotify</Text>
                      </Pressable>
                    </>
                  ) : trackError?.includes("403") ? (
                    <>
                      <Text style={s.fourOhThreeTitle}>Access Restricted</Text>
                      <Text style={s.fourOhThreeBody}>
                        This playlist returned a <Text style={{ color: GREEN, fontFamily: "Inter_600SemiBold" }}>403 Forbidden</Text> error.{"\n\n"}
                        If your account is already in the dashboard, try <Text style={{ color: GREEN, fontFamily: "Inter_600SemiBold" }}>Reconnecting Spotify</Text> to get a fresh token with the latest permissions.
                      </Text>
                      <Pressable
                        style={({ pressed }) => [s.connectBtn, { marginTop: 20 }, pressed && { opacity: 0.8 }]}
                        onPress={() => { closePlaylist(); setTimeout(handleDisconnect, 400); }}
                      >
                        <Feather name="refresh-cw" size={16} color="#fff" />
                        <Text style={s.connectBtnText}>Reconnect Spotify</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [s.retryBtn, { marginTop: 12 }, pressed && { opacity: 0.75 }]}
                        onPress={() => selPl && openPlaylist(selPl)}
                      >
                        <Feather name="refresh-cw" size={13} color={GREEN} />
                        <Text style={s.retryBtnText}>Retry</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={s.stateBody}>No songs found</Text>
                      {trackError ? <Text style={s.errorDetail}>{trackError}</Text> : null}
                      <Pressable
                        style={({ pressed }) => [s.retryBtn, { marginTop: 16 }, pressed && { opacity: 0.75 }]}
                        onPress={() => selPl && openPlaylist(selPl)}
                      >
                        <Feather name="refresh-cw" size={13} color={GREEN} />
                        <Text style={s.retryBtnText}>Retry</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={soScrollEnabled}
                  onScroll={e => { soScrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
                  scrollEventThrottle={16}
                  contentContainerStyle={{ paddingTop: 8, paddingBottom: sp.nowPlaying ? 330 : 40, paddingHorizontal: 16 }}
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
  eqBar: { width: 5, borderRadius: 3, backgroundColor: GREEN },

  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontFamily: "Inter_600SemiBold",
    paddingTop: 8, paddingBottom: 2,
  },
  plSubtitle: {
    color: GREEN, fontSize: 11, fontFamily: "Inter_500Medium",
    textAlign: "center", marginTop: 1, paddingBottom: 6,
  },

  disconnectBtn: { position: "absolute", right: 16, bottom: 8, padding: 8 },

  centred: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },

  stateTitle: {
    color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold",
    marginBottom: 10, textAlign: "center",
  },
  stateBody: {
    color: "rgba(255,255,255,0.45)", fontSize: 14,
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 24,
  },
  errorDetail: {
    color: GREEN, fontSize: 11, fontFamily: "Inter_400Regular",
    textAlign: "center", marginTop: 12, paddingHorizontal: 16,
  },
  connectBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: GREEN, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  connectBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  fourOhThreeTitle: {
    color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold",
    marginBottom: 14, textAlign: "center",
  },
  fourOhThreeBody: {
    color: "rgba(255,255,255,0.55)", fontSize: 14,
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 20,
  },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: GREEN, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 18,
  },
  retryBtnText: { color: GREEN, fontSize: 13, fontFamily: "Inter_500Medium" },

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
  songTitleActive: { color: GREEN },
  songArtist:      { fontSize: 12, color: GREY, fontFamily: "Inter_400Regular", marginTop: 1 },
  songDuration:    { fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular" },
});
