import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

  const setNowPlaying = useCallback((np: AppleNowPlaying | null) => {
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
    try { await AppleMusicKit.pause(); setIsPlaying(false); } catch {}
  }, []);

  const play = useCallback(async () => {
    if (!AppleMusicKit) return;
    try { await AppleMusicKit.resumePlay(); setIsPlaying(true); } catch {}
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
    try {
      await AppleMusicKit.playSongInPlaylist(np.playlistId, nextIdx);
      const next = np.songs[nextIdx];
      setNowPlaying({ ...np, songIndex: nextIdx, title: next.title, artist: next.artist });
    } catch {}
  }, [setNowPlaying]);

  const skipToPrevious = useCallback(async () => {
    const np = nowPlayingRef.current;
    if (!AppleMusicKit || !np) return;
    const prevIdx = Math.max(0, np.songIndex - 1);
    try {
      await AppleMusicKit.playSongInPlaylist(np.playlistId, prevIdx);
      const prev = np.songs[prevIdx];
      setNowPlaying({ ...np, songIndex: prevIdx, title: prev.title, artist: prev.artist });
    } catch {}
  }, [setNowPlaying]);

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
