import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import TrackPlayer, {
  Capability,
  Event,
  State,
  useActiveTrack,
  usePlaybackState,
  useProgress,
} from "react-native-track-player";

export type MusicTrack = { id: string; name: string; uri: string };

type PlayerState = {
  track: MusicTrack | null;
  trackIndex: number | null;
  tracks: MusicTrack[];
  isPlaying: boolean;
  posMs: number;
  durMs: number;
};

type MusicPlayerContextValue = PlayerState & {
  playTrack: (idx: number, list: MusicTrack[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  skipBack: () => Promise<void>;
  skipForward: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
};

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

let playerSetup = false;

async function ensureSetup() {
  if (playerSetup) return;
  playerSetup = true;
  try {
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
    });
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      progressUpdateEventInterval: 1,
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
    });
  } catch (e) {
    // setupPlayer throws if already called — safe to ignore
    playerSetup = true;
  }
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const tracksRef     = useRef<MusicTrack[]>([]);
  const trackIdxRef   = useRef<number | null>(null);

  // RNTP hooks — these update MPNowPlayingInfoCenter automatically
  const activeTrack   = useActiveTrack();
  const pbState       = usePlaybackState();
  const progress      = useProgress(500);   // polls every 500ms

  // Mirror RNTP state into our context shape (posMs / durMs stay in ms)
  const isPlaying = pbState.state === State.Playing || pbState.state === State.Buffering;
  const posMs     = Math.floor((progress.position ?? 0) * 1000);
  const durMs     = Math.floor((progress.duration  ?? 0) * 1000);

  // Derive our MusicTrack from the active RNTP track
  const track: MusicTrack | null = activeTrack
    ? { id: String(activeTrack.id), name: String(activeTrack.title ?? ""), uri: String(activeTrack.url) }
    : null;

  const playTrack = useCallback(async (idx: number, list: MusicTrack[]) => {
    if (idx < 0 || idx >= list.length) return;
    await ensureSetup();

    tracksRef.current   = list;
    trackIdxRef.current = idx;

    const rnTracks = list.map(t => ({
      id:    t.id,
      url:   t.uri,
      title: t.name,
    }));

    try {
      await TrackPlayer.reset();
      await TrackPlayer.add(rnTracks);
      await TrackPlayer.skip(idx);
      await TrackPlayer.play();
    } catch (err) {
      console.error("[MusicPlayer] playTrack error:", err);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, [isPlaying]);

  const skipBack = useCallback(async () => {
    if (posMs > 3000) {
      await TrackPlayer.seekTo(0);
    } else {
      try { await TrackPlayer.skipToPrevious(); } catch {}
    }
  }, [posMs]);

  const skipForward = useCallback(async () => {
    try { await TrackPlayer.skipToNext(); } catch {}
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    await TrackPlayer.seekTo(ms / 1000);
  }, []);

  // Keep our refs in sync so skipBack has the right posMs
  useEffect(() => {
    if (activeTrack) {
      const idx = tracksRef.current.findIndex(t => t.id === String(activeTrack.id));
      if (idx !== -1) trackIdxRef.current = idx;
    }
  }, [activeTrack]);

  const value: MusicPlayerContextValue = {
    track,
    trackIndex: trackIdxRef.current,
    tracks: tracksRef.current,
    isPlaying,
    posMs,
    durMs,
    playTrack,
    togglePlay,
    skipBack,
    skipForward,
    seekTo,
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider");
  return ctx;
}
