import React, { createContext, useCallback, useContext, useState } from "react";

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
  nowPlaying: AppleNowPlaying | null;
  isPlaying: boolean;
  setNowPlaying: (np: AppleNowPlaying | null) => void;
  setIsPlaying: (v: boolean) => void;
  pause: () => Promise<void>;
  play: () => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
};

const AppleMusicPlayerContext = createContext<AppleMusicPlayerContextValue | null>(null);

export function AppleMusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [nowPlaying, setNowPlayingState] = useState<AppleNowPlaying | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const setNowPlaying = useCallback((np: AppleNowPlaying | null) => {
    setNowPlayingState(np);
    setIsPlaying(np !== null);
  }, []);

  const pause = useCallback(async () => {
    if (!AppleMusicKit) return;
    try { await AppleMusicKit.pause(); setIsPlaying(false); } catch {}
  }, []);

  const play = useCallback(async () => {
    if (!AppleMusicKit) return;
    try { await AppleMusicKit.resumePlay(); setIsPlaying(true); } catch {}
  }, []);

  const skipToNext = useCallback(async () => {
    if (!AppleMusicKit || !nowPlaying) return;
    const nextIdx = nowPlaying.songIndex + 1;
    if (nextIdx >= nowPlaying.songs.length) return;
    try {
      await AppleMusicKit.playSongInPlaylist(nowPlaying.playlistId, nextIdx);
      const next = nowPlaying.songs[nextIdx];
      setNowPlaying({
        ...nowPlaying,
        songIndex: nextIdx,
        title: next.title,
        artist: next.artist,
      });
    } catch {}
  }, [nowPlaying, setNowPlaying]);

  const skipToPrevious = useCallback(async () => {
    if (!AppleMusicKit || !nowPlaying) return;
    const prevIdx = Math.max(0, nowPlaying.songIndex - 1);
    try {
      await AppleMusicKit.playSongInPlaylist(nowPlaying.playlistId, prevIdx);
      const prev = nowPlaying.songs[prevIdx];
      setNowPlaying({
        ...nowPlaying,
        songIndex: prevIdx,
        title: prev.title,
        artist: prev.artist,
      });
    } catch {}
  }, [nowPlaying, setNowPlaying]);

  return (
    <AppleMusicPlayerContext.Provider value={{
      nowPlaying, isPlaying, setNowPlaying, setIsPlaying,
      pause, play, skipToNext, skipToPrevious,
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
