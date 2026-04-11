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

let AppleMusicKit: any = null;
try { AppleMusicKit = require("apple-musickit"); } catch {}

export type AppleSongInfo = {
  id: string;
  title: string;
  artist: string;
  duration: number;
};

export type AppleNowPlaying = {
  playlistId: string;
  playlistName: string;
  songIndex: number;
  songs: AppleSongInfo[];
  title: string;
  artist: string;
};

type AppleMusicPlayerContextValue = {
  nowPlaying:   AppleNowPlaying | null;
  isPlaying:    boolean;
  posMs:        number;
  durMs:        number;
  volume:       number;
  setNowPlaying: (np: AppleNowPlaying | null) => void;
  setIsPlaying:  (v: boolean) => void;
  pause:         () => Promise<void>;
  play:          () => Promise<void>;
  skipToNext:    () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekTo:        (ms: number) => Promise<void>;
  setVolume:     (v: number) => Promise<void>;
};

const AppleMusicPlayerContext = createContext<AppleMusicPlayerContextValue | null>(null);

export function AppleMusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [nowPlaying,  setNowPlayingState] = useState<AppleNowPlaying | null>(null);
  const [isPlaying,   setIsPlaying]       = useState(false);
  const [posMs,       setPosMs]           = useState(0);
  const [durMs,       setDurMs]           = useState(0);
  const [volume,      setVolumeState]     = useState(1);

  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;

  // Track whether the user explicitly paused, so foreground sync doesn't
  // auto-resume when they intentionally stopped.
  const userPausedRef = useRef(false);

  // Register our pause fn so My Music can silence us when it starts
  useEffect(() => {
    MusicSourceBus.registerPauseAppleMusic(() => {
      if (!AppleMusicKit) return;
      AppleMusicKit.pause().catch(() => {});
      setIsPlaying(false);
      userPausedRef.current = true;
    });
  }, []);

  // ── AppState — re-sync playback state when returning from background ───────
  // applicationQueuePlayer keeps playing when the phone is locked (it holds an
  // active AVAudioSession + UIBackgroundModes: audio).  But if the session was
  // interrupted (phone call, Siri, etc.) or our app was killed and relaunched,
  // the player may have stopped while our JS isPlaying flag stayed true.
  // On foreground: ask the native player for its actual state and reconcile.
  // If the player stopped unexpectedly and the user hadn't paused, resume.
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener("change", async (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev !== "active" && next === "active") {
        if (!AppleMusicKit || !nowPlayingRef.current) return;
        try {
          const actuallyPlaying: boolean = await AppleMusicKit.isPlayingNative();
          if (!actuallyPlaying && !userPausedRef.current) {
            // Player stopped while we were backgrounded but the user didn't pause —
            // resume (handles interruption-ended or brief session conflicts).
            await AppleMusicKit.resumePlay();
            setIsPlaying(true);
          } else {
            // Sync our UI to the real native state.
            setIsPlaying(actuallyPlaying);
          }
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);

  const setNowPlaying = useCallback((np: AppleNowPlaying | null) => {
    console.log("[AppleMusic] setNowPlaying:", np ? `${np.title} — ${np.artist} (idx ${np.songIndex} in playlist ${np.playlistId})` : "null");
    if (np) MusicSourceBus.notifyAppleMusicPlaying();
    userPausedRef.current = false;
    setNowPlayingState(np);
    setIsPlaying(np !== null);
    setPosMs(0);
    if (np) {
      const dur = np.songs[np.songIndex]?.duration ?? 0;
      setDurMs(Math.round(dur * 1000));
    } else {
      setDurMs(0);
    }
  }, []);

  // ── Poll position every 500 ms while playing ──────────────────────────────
  useEffect(() => {
    if (!isPlaying || !AppleMusicKit) return;
    const id = setInterval(async () => {
      try {
        const [pos, dur]: [number, number] = await Promise.all([
          AppleMusicKit.getCurrentTime(),
          AppleMusicKit.getDuration(),
        ]);
        setPosMs(Math.round(pos * 1000));
        if (dur > 0) setDurMs(Math.round(dur * 1000));
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const pause = useCallback(async () => {
    if (!AppleMusicKit) return;
    console.log("[AppleMusic] pause()");
    userPausedRef.current = true;
    try { await AppleMusicKit.pause(); setIsPlaying(false); console.log("[AppleMusic] pause: OK"); }
    catch (e) { console.log("[AppleMusic] pause ERROR:", e); }
  }, []);

  const play = useCallback(async () => {
    if (!AppleMusicKit) return;
    console.log("[AppleMusic] resumePlay()");
    userPausedRef.current = false;
    try { await AppleMusicKit.resumePlay(); setIsPlaying(true); console.log("[AppleMusic] resumePlay: OK"); }
    catch (e) { console.log("[AppleMusic] resumePlay ERROR:", e); }
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    if (!AppleMusicKit) return;
    try {
      await AppleMusicKit.seekTo(ms / 1000);
      setPosMs(ms);
    } catch {}
  }, []);

  const setVolume = useCallback(async (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (!AppleMusicKit) return;
    try { await AppleMusicKit.setVolume(clamped); } catch {}
  }, []);

  const skipToNext = useCallback(async () => {
    const np = nowPlayingRef.current;
    if (!AppleMusicKit || !np) return;
    const nextIdx = np.songIndex + 1;
    if (nextIdx >= np.songs.length) return;
    const next = np.songs[nextIdx];
    console.log("[AppleMusic] skipToNext: idx", nextIdx, "—", next.title);
    setNowPlayingState({ ...np, songIndex: nextIdx, title: next.title, artist: next.artist });
    setPosMs(0);
    setDurMs(Math.round(next.duration * 1000));
    try { await AppleMusicKit.playSongInPlaylist(np.playlistId, nextIdx); console.log("[AppleMusic] skipToNext: OK"); }
    catch (e) { console.log("[AppleMusic] skipToNext ERROR:", e); }
  }, []);

  const skipToPrevious = useCallback(async () => {
    const np = nowPlayingRef.current;
    if (!AppleMusicKit || !np) return;
    const prevIdx = Math.max(0, np.songIndex - 1);
    const prev = np.songs[prevIdx];
    console.log("[AppleMusic] skipToPrevious: idx", prevIdx, "—", prev.title);
    setNowPlayingState({ ...np, songIndex: prevIdx, title: prev.title, artist: prev.artist });
    setPosMs(0);
    setDurMs(Math.round(prev.duration * 1000));
    try { await AppleMusicKit.playSongInPlaylist(np.playlistId, prevIdx); console.log("[AppleMusic] skipToPrevious: OK"); }
    catch (e) { console.log("[AppleMusic] skipToPrevious ERROR:", e); }
  }, []);

  return (
    <AppleMusicPlayerContext.Provider value={{
      nowPlaying, isPlaying, posMs, durMs, volume,
      setNowPlaying, setIsPlaying,
      pause, play, skipToNext, skipToPrevious, seekTo, setVolume,
    }}>
      {children}
    </AppleMusicPlayerContext.Provider>
  );
}

export function useAppleMusicPlayer() {
  const ctx = useContext(AppleMusicPlayerContext);
  if (!ctx) throw new Error("useAppleMusicPlayer must be inside AppleMusicPlayerProvider");
  return ctx;
}
