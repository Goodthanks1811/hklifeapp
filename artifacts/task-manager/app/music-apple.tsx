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

type ApplePlaylist = { id: string; name: string; count: number };
type AppleSong     = { id: string; title: string; artist: string; albumTitle: string; duration: number };
type AuthStatus    = "authorized" | "denied" | "restricted" | "notDetermined" | "unavailable" | "loading";

let AppleMusicKit: any = null;
try {
  AppleMusicKit = require("apple-musickit");
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
  playingPlaylistId,
  playingSongIndex,
  onPlaySong,
}: {
  pl: ApplePlaylist;
  playingPlaylistId: string | null;
  playingSongIndex: number | null;
  onPlaySong: (pl: ApplePlaylist, songIndex: number, songs: AppleSong[]) => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [songs, setSongs]               = useState<AppleSong[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const isThisPlaying = playingPlaylistId === pl.id;

  const toggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (songs.length === 0 && AppleMusicKit) {
      setLoadingSongs(true);
      try {
        const result: AppleSong[] = await AppleMusicKit.getSongsInPlaylist(pl.id);
        setSongs(result);
      } catch { setSongs([]); }
      finally { setLoadingSongs(false); }
    }
  };

  return (
    <View style={s.card}>
      {/* Playlist header row */}
      <Pressable
        style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
        onPress={toggle}
      >
        <View style={[s.iconCell, isThisPlaying && s.iconCellPlaying]}>
          {isThisPlaying
            ? <Feather name="volume-2" size={18} color={RED} />
            : <Feather name="headphones" size={18} color={RED} />}
        </View>
        <View style={s.rowTextWrap}>
          <Text style={[s.rowName, isThisPlaying && s.rowNamePlaying]}>{pl.name}</Text>
          {pl.count > 0 && (
            <Text style={s.rowCount}>{pl.count} song{pl.count !== 1 ? "s" : ""}</Text>
          )}
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="rgba(255,255,255,0.3)"
        />
      </Pressable>

      {/* Expanded song list */}
      {expanded && (
        <View style={s.songList}>
          <View style={s.songDivider} />
          {loadingSongs ? (
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
                      ? <Feather name="volume-2" size={13} color={RED} />
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
          )}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MusicAppleScreen() {
  const goBack = () => router.back();
  const insets   = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;
  const am       = useAppleMusicPlayer();

  const [authStatus, setAuthStatus]   = useState<AuthStatus>("loading");
  const [playlists, setPlaylists]     = useState<ApplePlaylist[]>([]);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null);
  const [playingSongIndex, setPlayingSongIndex]   = useState<number | null>(null);
  const [loadingKey, setLoadingKey]               = useState<string | null>(null);

  // Sync from context (e.g. if user navigated away and came back)
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
        const namesRaw = await AsyncStorage.getItem("music_apple_filter_names");
        if (namesRaw) {
          const names: string[] = JSON.parse(namesRaw);
          if (names.length > 0) {
            setPlaylists(all.filter(p => names.some(n => fuzzyMatch(p.name, n))));
            return;
          }
        }
        setPlaylists(all);
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
      await AppleMusicKit.playSongInPlaylist(pl.id, songIndex);
    } catch {
      // ignore
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
        contentContainerStyle={{ paddingTop: 16, paddingBottom: am.nowPlaying ? 330 : 16, paddingHorizontal: 16 }}
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

  // Playlist card — no red tint on the whole card
  card: {
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
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
    fontFamily: "Inter_500Medium",
  },
  rowNamePlaying: { color: "#fff" },
  rowCount: {
    fontSize: 12, color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular", marginTop: 2,
  },

  // Song list
  songList: { paddingHorizontal: 8, paddingBottom: 10, gap: 4 },
  songDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 6, marginBottom: 6 },
  songLoading: { paddingVertical: 16, alignItems: "center" },
  songEmpty: { color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", paddingVertical: 12, fontFamily: "Inter_400Regular" },

  // Each song is its own black card row — same glossy style as My Music track rows
  songRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.40, shadowRadius: 7, elevation: 5,
  },

  songIndex: { width: 22, alignItems: "center" },
  songIndexTx: { fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "Inter_400Regular" },

  songInfo: { flex: 1, minWidth: 0 },
  songTitle: { fontSize: 14, fontWeight: "500", color: "#ddd", fontFamily: "Inter_500Medium" },
  songTitleActive: { color: RED },
  songArtist: { fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular", marginTop: 1 },
  songDuration: { fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular" },

});
