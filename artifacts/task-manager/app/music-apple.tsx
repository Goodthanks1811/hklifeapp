import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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

const ITEM_H   = 52;
const ITEM_GAP = 8;

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

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
function PlaylistRow({ pl, isPlaying, onPress }: {
  pl: ApplePlaylist; isPlaying: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.plRow, pressed && { opacity: 0.75 }]}
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
      <Feather name="chevron-right" size={16} color="#444" />
    </Pressable>
  );
}

// ── Song row ──────────────────────────────────────────────────────────────────
function SongRow({ song, idx, plId, isActive, loadingKey, onPlay }: {
  song: AppleSong; idx: number; plId: string;
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
    </Pressable>
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
      songsCacheRef.current[pl.id] = result;
      setSelPlSongs(result);
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
        const namesRaw = await AsyncStorage.getItem("music_apple_filter_names");
        if (namesRaw) {
          const names: string[] = JSON.parse(namesRaw);
          if (names.length > 0) { setPlaylists(all.filter(p => names.some(n => fuzzyMatch(p.name, n)))); return; }
        }
        setPlaylists(all);
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
        contentContainerStyle={{ paddingTop: 16, paddingBottom: am.nowPlaying ? 330 : 40, gap: ITEM_GAP, paddingHorizontal: 16 }}
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
                  contentContainerStyle={{ paddingTop: 8, paddingBottom: am.nowPlaying ? 330 : 40, gap: ITEM_GAP, paddingHorizontal: 16 }}
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
  eqBar: { width: 5, borderRadius: 3, backgroundColor: SILVER },

  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontFamily: "Inter_600SemiBold",
    paddingTop: 8, paddingBottom: 2,
  },
  plSubtitle: {
    color: SILVER, fontSize: 11, fontFamily: "Inter_500Medium",
    textAlign: "center", marginTop: 1, paddingBottom: 6,
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
  songTitleActive: { color: SILVER },
  songArtist:      { fontSize: 12, color: GREY, fontFamily: "Inter_400Regular", marginTop: 1 },
  songDuration:    { fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular" },
});
