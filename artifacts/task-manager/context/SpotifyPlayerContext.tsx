import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { MusicSourceBus } from "@/utils/MusicSourceBus";
import { getStoredTokens, clearStoredTokens } from "@/utils/SpotifyAuth";

let AppleMusicKit: any = null;
try { AppleMusicKit = require("apple-musickit"); } catch {}

let SpotifyRemote: any = null;
try {
  const mod     = require("react-native-spotify-remote");
  SpotifyRemote = mod.SpotifyRemote ?? mod.default?.SpotifyRemote;
} catch {}

const REMOTE_AVAILABLE = SpotifyRemote != null;

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

    // Connect to the Spotify app using our PKCE-obtained access token.
    // SpotifySession.authorize is intentionally NOT called here — we do our own
    // OAuth via expo-auth-session (PKCE).  Calling authorize would re-open the
    // Spotify app for a second login prompt, and it used an empty clientID from
    // the build-time env var (EXPO_PUBLIC_SPOTIFY_CLIENT_ID) rather than the
    // user-configured value in AsyncStorage, causing every connect attempt to
    // fail silently and prevent playUri from ever being reached.
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

  const nowPlayingRef  = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;

  // Track explicit user pause intent so stale polls can't override it
  const userPausedRef = useRef(false);

  useEffect(() => {
    MusicSourceBus.registerPauseSpotify(async () => {
      if (!REMOTE_AVAILABLE) return;
      userPausedRef.current = true;
      try { await SpotifyRemote?.pause?.(); } catch {}
      setIsPlaying(false);
    });
  }, []);

  // ── Silent background keepalive ────────────────────────────────────────────
  // When Spotify is the active source our process has no AVAudioSession (the
  // Spotify app owns the audio).  Register start/stop callbacks with MusicSourceBus
  // so the session is maintained via a 0-amplitude PCM loop (MixWithOthers) in
  // the native AppleMusicKitModule, preventing iOS from killing us under memory
  // pressure when the phone is locked.
  useEffect(() => {
    MusicSourceBus.registerStartKeepalive(() => {
      AppleMusicKit?.startSilentKeepAlive?.().catch(() => {});
    });
    MusicSourceBus.registerStopKeepalive(() => {
      AppleMusicKit?.stopSilentKeepAlive?.().catch(() => {});
    });
    // Native watchdog: a Swift Timer (2 s) that calls setActive(true) at the
    // native level — independent of the JS thread.  Keeps the AVAudioSession
    // alive through RNTP's nil-window deactivations on iOS 26.
    MusicSourceBus.registerStartWatchdog(() => {
      AppleMusicKit?.startNativeWatchdog?.().catch?.(() => {});
    });
    MusicSourceBus.registerStopWatchdog(() => {
      AppleMusicKit?.stopNativeWatchdog?.().catch?.(() => {});
    });
  }, []);

  // ── Audio output lost (CarPlay / headphones disconnected) ──────────────────
  // When any external audio output is removed, pause all sources immediately
  // and prevent watchdogs from auto-resuming (mimics standard iOS Music app
  // behaviour where headphone unplug pauses playback).
  useEffect(() => {
    let sub: any;
    try {
      const { addAudioOutputLostListener } = require("apple-musickit");
      sub = addAudioOutputLostListener(() => {
        MusicSourceBus.pauseAll();
      });
    } catch {
      // Native module not available (Expo Go / simulator)
    }
    return () => { try { sub?.remove(); } catch {} };
  }, []);

  // ── AppState — reconnect Spotify remote when returning to foreground ───────
  // The Spotify remote connection can drop while our app is backgrounded.
  // Re-running ensureRemoteConnected() on 'active' restores it silently so the
  // next user interaction (play/pause/seek) works without a manual reconnect.
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev !== "active" && next === "active") {
        // Re-establish remote connection in the background; don't block UI.
        if (REMOTE_AVAILABLE && nowPlayingRef.current) {
          _remoteConnected  = false; // force reconnect attempt
          _connectingRemote = false;
          ensureRemoteConnected().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, []);

  const setNowPlaying = useCallback((np: SpotifyNowPlaying | null) => {
    if (np) MusicSourceBus.notifySpotifyPlaying();
    userPausedRef.current = false;
    setNowPlayingState(np);
    setIsPlaying(np !== null);
    setPosMs(0);
    if (np) {
      setDurMs(np.songs[np.songIndex]?.durationMs ?? 0);
    } else {
      setDurMs(0);
    }
  }, []);

  // Poll Spotify player state whenever a track is loaded (not just when playing).
  // Depends on nowPlaying so the interval is stable across pause/resume cycles.
  // A cancellation flag prevents stale async results from firing after cleanup.
  useEffect(() => {
    if (!nowPlaying || !REMOTE_AVAILABLE) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const ok = await ensureRemoteConnected();
        if (!ok || cancelled) return;
        const state = await SpotifyRemote?.getPlayerState?.();
        if (state && !cancelled) {
          setPosMs(state.playbackPosition ?? 0);
          const dur = state.track?.duration ?? 0;
          if (dur > 0) setDurMs(dur);
          // Only sync play/pause from Spotify if the user hasn't explicitly paused.
          // This prevents a stale or delayed poll result from re-starting playback.
          if (!userPausedRef.current) {
            setIsPlaying(!state.isPaused);
          }
          setRemoteConnected(true);
        }
      } catch (err) {
        console.warn("[SpotifyRemote] getPlayerState:", err);
      }
    }, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [nowPlaying]);

  const pause = useCallback(async () => {
    if (!REMOTE_AVAILABLE) return;
    userPausedRef.current = true;
    setIsPlaying(false);
    try {
      const ok = await ensureRemoteConnected();
      if (!ok) return;
      await SpotifyRemote?.pause?.();
    } catch (err) {
      console.warn("[SpotifyRemote] pause:", err);
    }
  }, []);

  const play = useCallback(async () => {
    if (!REMOTE_AVAILABLE) return;
    userPausedRef.current = false;
    setIsPlaying(true);
    try {
      const ok = await ensureRemoteConnected();
      if (!ok) { setIsPlaying(false); return; }
      await SpotifyRemote?.resume?.();
    } catch (err) {
      console.warn("[SpotifyRemote] resume:", err);
      setIsPlaying(false);
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
    userPausedRef.current = false;
    setNowPlayingState({ ...np, songIndex: nextIdx, title: next.title, artist: next.artist });
    setIsPlaying(true);
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
    userPausedRef.current = false;
    setNowPlayingState({ ...np, songIndex: prevIdx, title: prev.title, artist: prev.artist });
    setIsPlaying(true);
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
