import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Audio } from "expo-av";

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

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const soundRef      = useRef<Audio.Sound | null>(null);
  const tracksRef     = useRef<MusicTrack[]>([]);
  const trackIdxRef   = useRef<number | null>(null);

  const [state, setState] = useState<PlayerState>({
    track: null, trackIndex: null, tracks: [],
    isPlaying: false, posMs: 0, durMs: 0,
  });

  const patch = (p: Partial<PlayerState>) => setState(s => ({ ...s, ...p }));

  const stopAndUnload = async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch {}
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  };

  const playTrack = useCallback(async (idx: number, list: MusicTrack[]) => {
    if (idx < 0 || idx >= list.length) return;
    const t = list[idx];
    tracksRef.current   = list;
    trackIdxRef.current = idx;

    await stopAndUnload();
    patch({ track: t, trackIndex: idx, tracks: list, isPlaying: false, posMs: 0, durMs: 0 });

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: t.uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        (status) => {
          if (!status.isLoaded) return;
          patch({
            posMs: status.positionMillis,
            durMs: status.durationMillis ?? 0,
            isPlaying: status.isPlaying,
          });
          if (status.didJustFinish) {
            const cur  = trackIdxRef.current ?? 0;
            const next = (cur + 1) % tracksRef.current.length;
            setTimeout(() => playTrack(next, tracksRef.current), 400);
          }
        }
      );
      soundRef.current = sound;
    } catch (err) {
      console.error("[MusicPlayer] play error:", err);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  }, []);

  const skipBack = useCallback(async () => {
    const s = state;
    if (s.posMs > 3000 && soundRef.current) {
      await soundRef.current.setPositionAsync(0);
    } else {
      const list = tracksRef.current;
      const cur  = trackIdxRef.current;
      const idx  = cur === null ? 0 : (cur - 1 + list.length) % list.length;
      await playTrack(idx, list);
    }
  }, [state, playTrack]);

  const skipForward = useCallback(async () => {
    const list = tracksRef.current;
    const cur  = trackIdxRef.current;
    const idx  = cur === null ? 0 : (cur + 1) % list.length;
    await playTrack(idx, list);
  }, [playTrack]);

  const seekTo = useCallback(async (ms: number) => {
    if (!soundRef.current) return;
    patch({ posMs: ms });
    try { await soundRef.current.setPositionAsync(ms); } catch {}
  }, []);

  return (
    <MusicPlayerContext.Provider value={{ ...state, playTrack, togglePlay, skipBack, skipForward, seekTo }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider");
  return ctx;
}
