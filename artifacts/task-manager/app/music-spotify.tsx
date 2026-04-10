import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
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
import { getUserPlaylists, getPlaylistTracks, SpotifyPlaylist, SpotifyTrack } from "@/utils/SpotifyAPI";
import { getStoredTokens, clearStoredTokens, authenticateSpotify } from "@/utils/SpotifyAuth";

const GREEN  = "#1DB954";
const BG     = "#111111";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";
const GREY   = "#888";

const ITEM_H   = 52;
const ITEM_GAP = 8;

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

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
function PlaylistRow({ pl, isPlaying, onPress }: {
  pl: SpotifyPlaylist; isPlaying: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.plRow, pressed && { opacity: 0.75 }]}
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
      <Feather name="chevron-right" size={16} color="#444" />
    </Pressable>
  );
}

// ── Song row ──────────────────────────────────────────────────────────────────
function SongRow({ song, idx, plId, isActive, loadingKey, onPlay }: {
  song: SpotifyTrack; idx: number; plId: string;
  isActive: boolean; loadingKey: string | null;
  onPlay: () => void;
}) {
  const loading = loadingKey === `${plId}:${idx}`;
  return (
    <Pressable
      onPress={onPlay}
      style={({ pressed }) => [s.songRow, pressed && { opacity: 0.75 }]}
    >
      <View style={s.songIcon}>
        {loading
          ? <ActivityIndicator size="small" color={GREEN} />
          : <Feather
              name={isActive ? "volume-2" : "volume"}
              size={16}
              color={isActive ? GREEN : "rgba(255,255,255,0.25)"}
            />}
      </View>
      <View style={s.songInfo}>
        <Text style={[s.songTitle, isActive && s.songTitleActive]} numberOfLines={1}>{song.title}</Text>
        {song.artist ? <Text style={s.songArtist} numberOfLines={1}>{song.artist}</Text> : null}
      </View>
      {song.durationMs > 0 && <Text style={s.songDuration}>{fmtMs(song.durationMs)}</Text>}
    </Pressable>
  );
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
      songsCacheRef.current[pl.id] = result;
      setSelPlSongs(result);
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

  const loadPlaylists = useCallback(async () => {
    setErrorMsg(null);
    setIs403(false);
    try {
      const tokens = await getStoredTokens();
      if (!tokens) { setAuthStatus("disconnected"); return; }
      setAuthStatus("connected");
      const all = await getUserPlaylists();
      const savedRaw = await AsyncStorage.getItem("music_spotify_playlists");
      if (savedRaw) {
        const saved: { name: string; url: string }[] = JSON.parse(savedRaw);
        const savedIds: string[] = saved
          .map(pl => { const m = pl.url.match(/spotify:\/\/playlist\/([A-Za-z0-9]+)/); return m ? m[1] : null; })
          .filter(Boolean) as string[];
        if (savedIds.length > 0) {
          const byId = new Map(all.map(p => [p.id, p]));
          setPlaylists(savedIds.map(id => byId.get(id)).filter(Boolean) as typeof all);
          return;
        }
      }
      setPlaylists(all);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg === "not_authenticated") setAuthStatus("disconnected");
      else if (msg.includes("403")) { setIs403(true); setErrorMsg(msg); }
      else setErrorMsg(msg);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadPlaylists(); }, [loadPlaylists]));

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

  // ── Auth state body (shown in main panel) ─────────────────────────────────
  const renderBody = () => {
    if (authStatus === "loading") {
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
            <Text style={s.fourOhThreeTitle}>Developer Mode Restriction</Text>
            <Text style={s.fourOhThreeBody}>
              Your Spotify app is in <Text style={{ color: GREEN, fontFamily: "Inter_600SemiBold" }}>Development Mode</Text>, which means only accounts you explicitly allow can use it.{"\n\n"}
              To fix this, open your Spotify Developer Dashboard, go to your app → <Text style={{ color: GREEN, fontFamily: "Inter_600SemiBold" }}>Users and Access</Text>, and add your Spotify account email.
            </Text>
            <Pressable
              style={({ pressed }) => [s.dashboardBtn, pressed && { opacity: 0.75 }]}
              onPress={() => Linking.openURL("https://developer.spotify.com/dashboard")}
            >
              <Feather name="external-link" size={14} color="#fff" />
              <Text style={s.dashboardBtnText}>Open Spotify Developer Dashboard</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.75 }]}
              onPress={loadPlaylists}
            >
              <Feather name="refresh-cw" size={13} color={GREEN} />
              <Text style={s.retryBtnText}>Retry</Text>
            </Pressable>
            <Text style={s.errorDetail}>{errorMsg}</Text>
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
        contentContainerStyle={{ paddingTop: 16, paddingBottom: sp.nowPlaying ? 330 : 40, gap: ITEM_GAP, paddingHorizontal: 16 }}
      >
        {playlists.map(pl => (
          <PlaylistRow
            key={pl.id}
            pl={pl}
            isPlaying={playingPlaylistId === pl.id}
            onPress={() => openPlaylist(pl)}
          />
        ))}
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
                  <Text style={s.stateBody}>No songs found</Text>
                  {trackError ? <Text style={s.errorDetail}>{trackError}</Text> : null}
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingTop: 8, paddingBottom: sp.nowPlaying ? 330 : 40, gap: ITEM_GAP, paddingHorizontal: 16 }}
                >
                  {selPlSongs.map((song, idx) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      idx={idx}
                      plId={selPl.id}
                      isActive={playingPlaylistId === selPl.id && playingSongIndex === idx}
                      loadingKey={loadingKey}
                      onPlay={() => handlePlaySong(selPl, idx, selPlSongs)}
                    />
                  ))}
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
    backgroundColor: BG, paddingTop: 28, paddingBottom: 4,
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
  dashboardBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: GREEN, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 20, marginBottom: 12,
  },
  dashboardBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: GREEN, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 18,
  },
  retryBtnText: { color: GREEN, fontSize: 13, fontFamily: "Inter_500Medium" },

  // Playlist rows
  plRow: {
    height: 62, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
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
  songIcon:        { width: 28, alignItems: "center" },
  songInfo:        { flex: 1, minWidth: 0 },
  songTitle:       { fontSize: 14, color: "#fff", fontFamily: "Inter_500Medium" },
  songTitleActive: { color: GREEN },
  songArtist:      { fontSize: 12, color: GREY, fontFamily: "Inter_400Regular", marginTop: 1 },
  songDuration:    { fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular" },
});
