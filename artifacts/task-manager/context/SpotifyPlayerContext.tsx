import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { MusicSourceBus } from "@/utils/MusicSourceBus";
import { getStoredTokens, clearStoredTokens } from "@/utils/SpotifyAuth";

let SpotifyRemote: any     = null;
let SpotifySession: any    = null;
let Remote: any            = null;
try {
  const mod      = require("react-native-spotify-remote");
  SpotifyRemote  = mod.SpotifyRemote ?? mod.default?.SpotifyRemote;
  SpotifySession = mod.SpotifySession ?? mod.default?.SpotifySession;
  Remote         = mod;
} catch {}

const SPOTIFY_CLIENT_ID   = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const APP_SCHEME          = process.env.APP_VARIANT === "development" ? "hk-life-app-dev" : "hk-life-app";
const SPOTIFY_REDIRECT    = `${APP_SCHEME}://spotify-callback`;
const REMOTE_AVAILABLE    = SpotifyRemote != null;

export type SpotifySongInfo = {
  id:         string;
  uri:        string;
  title:      string;
  artist:     string;
  durationMs: number;
};

export type SpotifyNowPlaying = {
  playlistId:   string;
  playlistName: string;
  songIndex:    number;
  songs:        SpotifySongInfo[];
  title:        string;
  artist:       string;
};

type SpotifyPlayerContextValue = {
  nowPlaying:      SpotifyNowPlaying | null;
  isPlaying:       boolean;
  posMs:           number;
  durMs:           number;
  remoteConnected: boolean;
  setNowPlaying:   (np: SpotifyNowPlaying | null) => void;
  setIsPlaying:    (v: boolean) => void;
  play:            () => Promise<void>;
  pause:           () => Promise<void>;
  skipToNext:      () => Promise<void>;
  skipToPrevious:  () => Promise<void>;
  seekTo:          (ms: number) => Promise<void>;
};

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(null);

// ── Remote session helpers ────────────────────────────────────────────────────

let _remoteConnected  = false;
let _connectingRemote = false;

async function ensureRemoteConnected(): Promise<boolean> {
  if (!REMOTE_AVAILABLE) return false;
  if (_remoteConnected)  return true;
  if (_connectingRemote) return false;

  _connectingRemote = true;
  try {
    const tokens = await getStoredTokens();
    if (!tokens) { _connectingRemote = false; return false; }

    const sessionConfig = {
      clientID:    SPOTIFY_CLIENT_ID,
      redirectURL: SPOTIFY_REDIRECT,
      tokenSwapURL: undefined as string | undefined,
      tokenRefreshURL: undefined as string | undefined,
      scopes: [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative",
        "app-remote-control",
        "streaming",
      ],
    };

    if (SpotifySession?.authorize) {
      await SpotifySession.authorize(sessionConfig);
    }

    if (SpotifyRemote?.connect) {
      await SpotifyRemote.connect(tokens.accessToken);
    }

    _remoteConnected  = true;
    _connectingRemote = false;
    return true;
  } catch (err) {
    console.warn("[SpotifyRemote] connect failed:", err);
    _remoteConnected  = false;
    _connectingRemote = false;
    return false;
  }
}

async function disconnectRemote() {
  if (!REMOTE_AVAILABLE) return;
  _remoteConnected  = false;
  _connectingRemote = false;
  try { await SpotifyRemote?.disconnect?.(); } catch {}
}

export function SpotifyPlayerProvider({ children }: { children: React.ReactNode }) {
  const [nowPlaying,      setNowPlayingState] = useState<SpotifyNowPlaying | null>(null);
  const [isPlaying,       setIsPlaying]       = useState(false);
  const [posMs,           setPosMs]           = useState(0);
  const [durMs,           setDurMs]           = useState(0);
  const [remoteConnected, setRemoteConnected] = useState(false);

  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;

  useEffect(() => {
    MusicSourceBus.registerPauseSpotify(async () => {
      if (!REMOTE_AVAILABLE) return;
      try { await SpotifyRemote?.pause?.(); } catch {}
      setIsPlaying(false);
    });
  }, []);

  const setNowPlaying = useCallback((np: SpotifyNowPlaying | null) => {
    if (np) MusicSourceBus.notifySpotifyPlaying();
    setNowPlayingState(np);
    setIsPlaying(np !== null);
    setPosMs(0);
    if (np) {
      setDurMs(np.songs[np.songIndex]?.durationMs ?? 0);
    } else {
      setDurMs(0);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || !REMOTE_AVAILABLE) return;
    const id = setInterval(async () => {
      try {
        const ok = await ensureRemoteConnected();
        if (!ok) return;
        const state = await SpotifyRemote?.getPlayerState?.();
        if (state) {
          setPosMs(state.playbackPosition ?? 0);
          const dur = state.track?.duration ?? 0;
          if (dur > 0) setDurMs(dur);
          setIsPlaying(!state.isPaused);
          setRemoteConnected(true);
        }
      } catch (err) {
        console.warn("[SpotifyRemote] getPlayerState:", err);
      }
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying]);

  const pause = useCallback(async () => {
    if (!REMOTE_AVAILABLE) return;
    try {
      const ok = await ensureRemoteConnected();
      if (!ok) { setIsPlaying(false); return; }
      await SpotifyRemote?.pause?.();
      setIsPlaying(false);
    } catch (err) {
      console.warn("[SpotifyRemote] pause:", err);
      setIsPlaying(false);
    }
  }, []);

  const play = useCallback(async () => {
    if (!REMOTE_AVAILABLE) return;
    try {
      const ok = await ensureRemoteConnected();
      if (!ok) return;
      await SpotifyRemote?.resume?.();
      setIsPlaying(true);
    } catch (err) {
      console.warn("[SpotifyRemote] resume:", err);
    }
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    if (!REMOTE_AVAILABLE) return;
    try {
      const ok = await ensureRemoteConnected();
      if (!ok) return;
      await SpotifyRemote?.seek?.(ms);
      setPosMs(ms);
    } catch (err) {
      console.warn("[SpotifyRemote] seek:", err);
    }
  }, []);

  const skipToNext = useCallback(async () => {
    const np = nowPlayingRef.current;
    if (!np) return;
    const nextIdx = np.songIndex + 1;
    if (nextIdx >= np.songs.length) return;
    const next = np.songs[nextIdx];
    setNowPlayingState({ ...np, songIndex: nextIdx, title: next.title, artist: next.artist });
    setPosMs(0);
    setDurMs(next.durationMs);
    if (REMOTE_AVAILABLE && next.uri) {
      try {
        const ok = await ensureRemoteConnected();
        if (ok) await SpotifyRemote?.playUri?.(next.uri);
      } catch (err) { console.warn("[SpotifyRemote] skipToNext:", err); }
    }
  }, []);

  const skipToPrevious = useCallback(async () => {
    const np = nowPlayingRef.current;
    if (!np) return;
    const prevIdx = Math.max(0, np.songIndex - 1);
    const prev    = np.songs[prevIdx];
    setNowPlayingState({ ...np, songIndex: prevIdx, title: prev.title, artist: prev.artist });
    setPosMs(0);
    setDurMs(prev.durationMs);
    if (REMOTE_AVAILABLE && prev.uri) {
      try {
        const ok = await ensureRemoteConnected();
        if (ok) await SpotifyRemote?.playUri?.(prev.uri);
      } catch (err) { console.warn("[SpotifyRemote] skipToPrevious:", err); }
    }
  }, []);

  return (
    <SpotifyPlayerContext.Provider value={{
      nowPlaying, isPlaying, posMs, durMs, remoteConnected,
      setNowPlaying, setIsPlaying,
      play, pause, skipToNext, skipToPrevious, seekTo,
    }}>
      {children}
    </SpotifyPlayerContext.Provider>
  );
}

export function useSpotifyPlayer() {
  const ctx = useContext(SpotifyPlayerContext);
  if (!ctx) throw new Error("useSpotifyPlayer must be inside SpotifyPlayerProvider");
  return ctx;
}

export { ensureRemoteConnected, disconnectRemote, REMOTE_AVAILABLE };
