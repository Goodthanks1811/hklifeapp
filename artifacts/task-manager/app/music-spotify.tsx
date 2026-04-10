import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSpotifyPlayer, ensureRemoteConnected, disconnectRemote } from "@/context/SpotifyPlayerContext";
import { getUserPlaylists, getPlaylistTracks, SpotifyPlaylist, SpotifyTrack } from "@/utils/SpotifyAPI";
import {
  getStoredTokens,
  clearStoredTokens,
  authenticateSpotify,
} from "@/utils/SpotifyAuth";

const GREEN  = "#1DB954";
const BG     = "#111111";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

let SpotifyRemote: any = null;
try { SpotifyRemote = require("react-native-spotify-remote").SpotifyRemote; } catch {}

// ── EQ bar ────────────────────────────────────────────────────────────────────
function EqBar({ index, color }: { index: number; color: string }) {
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
  return <Animated.View style={[s.eqBar, { height, backgroundColor: color }]} />;
}

// ── Format duration ───────────────────────────────────────────────────────────
function fmtDurationMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m        = Math.floor(totalSec / 60);
  const sec      = totalSec % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Playlist row ──────────────────────────────────────────────────────────────
function PlaylistRow({
  pl,
  playingPlaylistId,
  playingSongIndex,
  onPlaySong,
}: {
  pl:                SpotifyPlaylist;
  playingPlaylistId: string | null;
  playingSongIndex:  number | null;
  onPlaySong:        (pl: SpotifyPlaylist, songIndex: number, songs: SpotifyTrack[]) => void;
}) {
  const [expanded,     setExpanded]     = useState(false);
  const [songs,        setSongs]        = useState<SpotifyTrack[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const isThisPlaying = playingPlaylistId === pl.id;

  const toggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (songs.length === 0) {
      setLoadingSongs(true);
      try {
        const result = await getPlaylistTracks(pl.id);
        setSongs(result);
      } catch { setSongs([]); }
      finally { setLoadingSongs(false); }
    }
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
        onPress={toggle}
      >
        <View style={s.row}>
          <View style={[s.iconCell, isThisPlaying && s.iconCellPlaying]}>
            {isThisPlaying
              ? <Feather name="volume-2"   size={18} color={GREEN} />
              : <Feather name="headphones" size={18} color={GREEN} />}
          </View>
          <View style={s.rowTextWrap}>
            <Text style={s.rowName}>{pl.name}</Text>
            {pl.trackCount > 0 && (
              <Text style={s.rowCount}>{pl.trackCount} song{pl.trackCount !== 1 ? "s" : ""}</Text>
            )}
          </View>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="rgba(255,255,255,0.3)"
          />
        </View>
      </Pressable>

      {expanded && (
        loadingSongs ? (
          <View style={s.songLoading}>
            <ActivityIndicator color={GREEN} size="small" />
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
                    ? <Feather name="volume-2" size={14} color={GREEN} />
                    : <Text style={s.songIndexTx}>{idx + 1}</Text>}
                </View>
                <View style={s.songInfo}>
                  <Text style={[s.songTitle, isActiveSong && s.songTitleActive]} numberOfLines={1}>{song.title}</Text>
                  {song.artist ? (
                    <Text style={s.songArtist} numberOfLines={1}>{song.artist}</Text>
                  ) : null}
                </View>
                <Text style={s.songDuration}>{fmtDurationMs(song.durationMs)}</Text>
              </Pressable>
            );
          })
        )
      )}
    </>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MusicSpotifyScreen() {
  const goBack   = () => router.back();
  const insets   = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;
  const sp       = useSpotifyPlayer();

  const [authStatus,  setAuthStatus]  = useState<"loading" | "connected" | "disconnected">("loading");
  const [connecting,  setConnecting]  = useState(false);
  const [playlists,   setPlaylists]   = useState<SpotifyPlaylist[]>([]);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [loadingKey,  setLoadingKey]  = useState<string | null>(null);

  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null);
  const [playingSongIndex,  setPlayingSongIndex]  = useState<number | null>(null);

  // Sync from context when screen mounts
  useEffect(() => {
    if (sp.nowPlaying) {
      setPlayingPlaylistId(sp.nowPlaying.playlistId);
      setPlayingSongIndex(sp.nowPlaying.songIndex);
    }
  }, []);

  const loadPlaylists = useCallback(async () => {
    setErrorMsg(null);
    try {
      const tokens = await getStoredTokens();
      if (!tokens) { setAuthStatus("disconnected"); return; }

      setAuthStatus("connected");
      const all = await getUserPlaylists();

      // Read the user's saved playlist list from settings.
      // Stored as { name: string, url: string }[] under "music_spotify_playlists".
      // URLs are in the form: spotify://playlist/PLAYLIST_ID?si=...
      const savedRaw = await AsyncStorage.getItem("music_spotify_playlists");
      if (savedRaw) {
        const saved: { name: string; url: string }[] = JSON.parse(savedRaw);
        // Extract Spotify playlist IDs from the spotify:// deep-link URLs
        const savedIds: string[] = saved
          .map(pl => {
            const match = pl.url.match(/spotify:\/\/playlist\/([A-Za-z0-9]+)/);
            return match ? match[1] : null;
          })
          .filter(Boolean) as string[];

        if (savedIds.length > 0) {
          // Build a map for O(1) lookup and preserve the order from settings
          const byId = new Map(all.map(p => [p.id, p]));
          const filtered = savedIds
            .map(id => byId.get(id))
            .filter(Boolean) as typeof all;
          setPlaylists(filtered);
          return;
        }
      }

      // No saved list — show everything from the API
      setPlaylists(all);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg === "not_authenticated") {
        setAuthStatus("disconnected");
      } else {
        setErrorMsg(msg);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => { loadPlaylists(); }, [loadPlaylists]));

  // ── OAuth connect flow ────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    setErrorMsg(null);
    try {
      const result = await authenticateSpotify();
      if (result.type === "success") {
        await loadPlaylists();
      } else if (result.type === "error") {
        setErrorMsg(result.error);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setConnecting(false);
    }
  }, [connecting, loadPlaylists]);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    await disconnectRemote();
    await clearStoredTokens();
    sp.setNowPlaying(null);
    setPlaylists([]);
    setPlayingPlaylistId(null);
    setPlayingSongIndex(null);
    setAuthStatus("disconnected");
  }, [sp]);

  // ── Play a song ───────────────────────────────────────────────────────────
  const handlePlaySong = useCallback(async (pl: SpotifyPlaylist, songIndex: number, songs: SpotifyTrack[]) => {
    if (loadingKey) return;
    const key  = `${pl.id}:${songIndex}`;
    const song = songs[songIndex];
    if (!song) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingKey(key);
    setPlayingPlaylistId(pl.id);
    setPlayingSongIndex(songIndex);
    sp.setNowPlaying({
      playlistId:   pl.id,
      playlistName: pl.name,
      songIndex,
      songs,
      title:  song.title,
      artist: song.artist,
    });
    if (SpotifyRemote && song.uri) {
      try {
        const connected = await ensureRemoteConnected();
        if (connected) {
          await SpotifyRemote.playUri(song.uri);
        } else {
          console.warn("[Spotify] App Remote not connected — playback unavailable");
        }
      } catch (err) {
        console.warn("[SpotifyRemote] playUri:", err);
      }
    }
    setLoadingKey(null);
  }, [loadingKey, sp]);

  // ── Render states ─────────────────────────────────────────────────────────
  const renderBody = () => {
    if (authStatus === "loading") {
      return (
        <View style={s.centred}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      );
    }

    if (authStatus === "disconnected") {
      return (
        <View style={s.centred}>
          <Feather name="music" size={52} color={GREEN} style={{ marginBottom: 24 }} />
          <Text style={s.stateTitle}>Connect Spotify</Text>
          <Text style={s.stateBody}>
            Sign in with your Spotify account to access{"\n"}your playlists and control playback.
          </Text>
          {errorMsg ? <Text style={s.errorDetail}>{errorMsg}</Text> : null}
          <Pressable
            style={({ pressed }) => [s.connectBtn, pressed && { opacity: 0.8 }]}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Feather name="log-in" size={18} color="#fff" />
                  <Text style={s.connectBtnText}>Connect Spotify</Text>
                </>}
          </Pressable>
        </View>
      );
    }

    if (playlists.length === 0) {
      return (
        <View style={s.centred}>
          <Text style={s.stateBody}>
            No playlists found.{"\n"}Check Settings → Music → Spotify Playlists.
          </Text>
          {errorMsg ? <Text style={s.errorDetail}>{errorMsg}</Text> : null}
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: sp.nowPlaying ? 330 : 16, paddingHorizontal: 16 }}
      >
        {playlists.map((pl) => (
          <PlaylistRow
            key={pl.id}
            pl={pl}
            playingPlaylistId={playingPlaylistId}
            playingSongIndex={playingSongIndex}
            onPlaySong={handlePlaySong}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
        <View style={s.headerArea}>
          <Pressable style={s.eqWrap} onPress={goBack}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <EqBar key={i} index={i} color={GREEN} />
            ))}
          </Pressable>
          <Text style={s.pageTitle}>Spotify</Text>
          <Pressable style={s.backZone} onPress={goBack} />
          {authStatus === "connected" && (
            <Pressable style={s.disconnectBtn} onPress={handleDisconnect}>
              <Feather name="log-out" size={15} color="rgba(255,255,255,0.35)" />
            </Pressable>
          )}
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
  eqBar: { width: 5, borderRadius: 3 },

  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    paddingTop: 8,
  },

  disconnectBtn: {
    position: "absolute", right: 16, bottom: 16,
    padding: 8,
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
    marginBottom: 24,
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
  connectBtnText: {
    color: "#fff", fontSize: 15, fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  card: {
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, marginBottom: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  iconCell: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: ROW,
    alignItems: "center", justifyContent: "center",
  },
  iconCellPlaying: { backgroundColor: ROW },
  rowTextWrap: { flex: 1 },
  rowName: {
    fontSize: 15, fontWeight: "500", color: "#fff",
    fontFamily: "Inter_500Medium",
  },
  rowCount: {
    fontSize: 12, color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular", marginTop: 2,
  },

  songRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14, height: 62,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
    marginBottom: 8,
  },
  songLoading: { paddingVertical: 16, alignItems: "center" },
  songEmpty:   { color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", paddingVertical: 12, fontFamily: "Inter_400Regular" },

  songIndex:   { width: 22, alignItems: "center" },
  songIndexTx: { fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "Inter_400Regular" },

  songInfo:        { flex: 1, minWidth: 0 },
  songTitle:       { fontSize: 14, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
  songTitleActive: { color: GREEN },
  songArtist:      { fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular", marginTop: 1 },
  songDuration:    { fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular" },
});
