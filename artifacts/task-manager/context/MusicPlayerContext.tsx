import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

// Default artwork shown in the Dynamic Island / Lock Screen when no track art is available
const DEFAULT_ARTWORK = require('../assets/images/icon.png');

// ── Conditional RNTP load ─────────────────────────────────────────────────────
// react-native-track-player requires a native module only present in EAS builds.
// In Expo Go we fall back to the expo-av implementation (full playback, no Lock
// Screen widget).  In an EAS / production build RNTP takes over and adds Lock
// Screen Now Playing, Control Centre, and CarPlay.
let _TrackPlayer: any = null;
let _Capability:  any = {};
let _State:       any = {};
let _useActiveTrack:   (() => any) | null = null;
let _usePlaybackState: (() => any) | null = null;
let _useProgress:      ((interval?: number) => any) | null = null;

let RNTP_AVAILABLE = false;
try {
  const rntp        = require("react-native-track-player");
  _TrackPlayer      = rntp.default ?? rntp;
  _Capability       = rntp.Capability  ?? {};
  _State            = rntp.State       ?? {};
  _useActiveTrack   = rntp.useActiveTrack;
  _usePlaybackState = rntp.usePlaybackState;
  _useProgress      = rntp.useProgress;
  RNTP_AVAILABLE    = true;
} catch {
  // Expo Go — fall back to expo-av below
}

// ── Shared types ─────────────────────────────────────────────────────────────
export type MusicTrack = { id: string; name: string; uri: string };

type PlayerState = {
  track:      MusicTrack | null;
  trackIndex: number | null;
  tracks:     MusicTrack[];
  isPlaying:  boolean;
  posMs:      number;
  durMs:      number;
};

type MusicPlayerContextValue = PlayerState & {
  playTrack:   (idx: number, list: MusicTrack[]) => Promise<void>;
  togglePlay:  () => Promise<void>;
  skipBack:    () => Promise<void>;
  skipForward: () => Promise<void>;
  seekTo:      (ms: number) => Promise<void>;
};

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// RNTP PROVIDER  (EAS build — Lock Screen / CarPlay)
// ─────────────────────────────────────────────────────────────────────────────
let playerSetup = false;

async function ensureSetup() {
  if (playerSetup) return;
  playerSetup = true;
  try {
    await _TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
    await _TrackPlayer.updateOptions({
      capabilities: [
        _Capability.Play, _Capability.Pause,
        _Capability.SkipToNext, _Capability.SkipToPrevious,
        _Capability.SeekTo, _Capability.Stop,
      ],
      compactCapabilities: [_Capability.Play, _Capability.Pause, _Capability.SkipToNext],
      progressUpdateEventInterval: 1,
      notificationCapabilities: [
        _Capability.Play, _Capability.Pause,
        _Capability.SkipToNext, _Capability.SkipToPrevious, _Capability.SeekTo,
      ],
    });
  } catch {
    // already initialised — safe to ignore
  }
}

type RNTPState = {
  activeTrack: any;
  pbState:     any;
  progress:    { position: number; duration: number };
};

// Bridge component — hooks must always run, so isolate them here and only
// render this component when the native module is confirmed present.
function RNTPBridge({ onState }: { onState: (s: RNTPState) => void }) {
  const activeTrack = _useActiveTrack!();
  const pbState     = _usePlaybackState!();
  const progress    = _useProgress!(500);

  useEffect(() => {
    onState({ activeTrack, pbState, progress });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrack, pbState?.state, progress?.position, progress?.duration]);

  return null;
}

function RNTPProvider({ children }: { children: React.ReactNode }) {
  const tracksRef   = useRef<MusicTrack[]>([]);
  const trackIdxRef = useRef<number | null>(null);

  const [rtpState, setRtpState] = useState<RNTPState>({
    activeTrack: null,
    pbState:     { state: null },
    progress:    { position: 0, duration: 0 },
  });

  const { activeTrack, pbState, progress } = rtpState;
  const isPlaying = pbState?.state === _State.Playing || pbState?.state === _State.Buffering;
  const posMs     = Math.floor((progress?.position ?? 0) * 1000);
  const durMs     = Math.floor((progress?.duration  ?? 0) * 1000);

  const track: MusicTrack | null = activeTrack
    ? { id: String(activeTrack.id), name: String(activeTrack.title ?? ""), uri: String(activeTrack.url) }
    : null;

  const playTrack = useCallback(async (idx: number, list: MusicTrack[]) => {
    if (idx < 0 || idx >= list.length) return;
    await ensureSetup();
    tracksRef.current   = list;
    trackIdxRef.current = idx;
    const rnTracks = list.map(t => ({ id: t.id, url: t.uri, title: t.name, artist: 'HK Life', artwork: DEFAULT_ARTWORK }));
    try {
      await _TrackPlayer.reset();
      await _TrackPlayer.add(rnTracks);
      await _TrackPlayer.skip(idx);
      await _TrackPlayer.play();
    } catch (err) {
      console.error("[MusicPlayer] playTrack error:", err);
    }
  }, []);

  const togglePlay  = useCallback(async () => {
    if (isPlaying) { await _TrackPlayer.pause(); } else { await _TrackPlayer.play(); }
  }, [isPlaying]);

  const skipBack = useCallback(async () => {
    if (posMs > 3000) { await _TrackPlayer.seekTo(0); }
    else               { try { await _TrackPlayer.skipToPrevious(); } catch {} }
  }, [posMs]);

  const skipForward = useCallback(async () => {
    try { await _TrackPlayer.skipToNext(); } catch {}
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    await _TrackPlayer.seekTo(ms / 1000);
  }, []);

  useEffect(() => {
    if (activeTrack) {
      const idx = tracksRef.current.findIndex(t => t.id === String(activeTrack.id));
      if (idx !== -1) trackIdxRef.current = idx;
    }
  }, [activeTrack]);

  const value: MusicPlayerContextValue = {
    track, trackIndex: trackIdxRef.current, tracks: tracksRef.current,
    isPlaying, posMs, durMs, playTrack, togglePlay, skipBack, skipForward, seekTo,
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      <RNTPBridge onState={setRtpState} />
      {children}
    </MusicPlayerContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPO-AV PROVIDER  (Expo Go — real playback, no Lock Screen widget)
// ─────────────────────────────────────────────────────────────────────────────
function ExpoAvProvider({ children }: { children: React.ReactNode }) {
  const soundRef    = useRef<Audio.Sound | null>(null);
  const tracksRef   = useRef<MusicTrack[]>([]);
  const trackIdxRef = useRef<number | null>(null);

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
        playsInSilentModeIOS:     true,
        staysActiveInBackground:  true,
        interruptionModeIOS:      InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid:  InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid:        false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: t.uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        (status) => {
          if (!status.isLoaded) return;
          patch({
            posMs:     status.positionMillis,
            durMs:     status.durationMillis ?? 0,
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
    if (status.isPlaying) { await soundRef.current.pauseAsync(); }
    else                   { await soundRef.current.playAsync();  }
  }, []);

  const skipBack = useCallback(async () => {
    if (state.posMs > 3000 && soundRef.current) {
      await soundRef.current.setPositionAsync(0);
    } else {
      const list = tracksRef.current;
      const cur  = trackIdxRef.current;
      const idx  = cur === null ? 0 : (cur - 1 + list.length) % list.length;
      await playTrack(idx, list);
    }
  }, [state.posMs, playTrack]);

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

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT — picks the right provider automatically
// ─────────────────────────────────────────────────────────────────────────────
export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  if (RNTP_AVAILABLE) {
    return <RNTPProvider>{children}</RNTPProvider>;
  }
  return <ExpoAvProvider>{children}</ExpoAvProvider>;
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider");
  return ctx;
}
