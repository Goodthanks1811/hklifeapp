import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Conditional RNTP load ─────────────────────────────────────────────────────
// react-native-track-player requires a native module that doesn't exist in
// Expo Go. Using require() in a try/catch prevents the module-load crash so
// the app still runs in Expo Go (music features are simply disabled).
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
  // Expo Go — native module not present; music player will be a no-op
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type MusicTrack = { id: string; name: string; uri: string };

type RNTPState = {
  activeTrack: any;
  pbState:     any;
  progress:    { position: number; duration: number };
};

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

// ── Setup ─────────────────────────────────────────────────────────────────────
let playerSetup = false;

async function ensureSetup() {
  if (!RNTP_AVAILABLE || playerSetup) return;
  playerSetup = true;
  try {
    await _TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
    await _TrackPlayer.updateOptions({
      capabilities: [
        _Capability.Play,
        _Capability.Pause,
        _Capability.SkipToNext,
        _Capability.SkipToPrevious,
        _Capability.SeekTo,
        _Capability.Stop,
      ],
      compactCapabilities: [
        _Capability.Play,
        _Capability.Pause,
        _Capability.SkipToNext,
      ],
      progressUpdateEventInterval: 1,
      notificationCapabilities: [
        _Capability.Play,
        _Capability.Pause,
        _Capability.SkipToNext,
        _Capability.SkipToPrevious,
        _Capability.SeekTo,
      ],
    });
  } catch {
    // setupPlayer throws if already initialised — safe to ignore
  }
}

// ── RNTP hook bridge ──────────────────────────────────────────────────────────
// Hooks must be called unconditionally, so they live in their own component
// that is only *rendered* when RNTP is available. This satisfies React's
// rules of hooks while keeping the parent provider free of RNTP hook calls.
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

// ── Provider ──────────────────────────────────────────────────────────────────
export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
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
    if (!RNTP_AVAILABLE || idx < 0 || idx >= list.length) return;
    await ensureSetup();
    tracksRef.current   = list;
    trackIdxRef.current = idx;
    const rnTracks = list.map(t => ({ id: t.id, url: t.uri, title: t.name }));
    try {
      await _TrackPlayer.reset();
      await _TrackPlayer.add(rnTracks);
      await _TrackPlayer.skip(idx);
      await _TrackPlayer.play();
    } catch (err) {
      console.error("[MusicPlayer] playTrack error:", err);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (!RNTP_AVAILABLE) return;
    if (isPlaying) { await _TrackPlayer.pause(); }
    else            { await _TrackPlayer.play();  }
  }, [isPlaying]);

  const skipBack = useCallback(async () => {
    if (!RNTP_AVAILABLE) return;
    if (posMs > 3000) { await _TrackPlayer.seekTo(0); }
    else               { try { await _TrackPlayer.skipToPrevious(); } catch {} }
  }, [posMs]);

  const skipForward = useCallback(async () => {
    if (!RNTP_AVAILABLE) return;
    try { await _TrackPlayer.skipToNext(); } catch {}
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    if (!RNTP_AVAILABLE) return;
    await _TrackPlayer.seekTo(ms / 1000);
  }, []);

  // Keep trackIndex ref in sync when RNTP reports a new active track
  useEffect(() => {
    if (activeTrack) {
      const idx = tracksRef.current.findIndex(t => t.id === String(activeTrack.id));
      if (idx !== -1) trackIdxRef.current = idx;
    }
  }, [activeTrack]);

  const value: MusicPlayerContextValue = {
    track,
    trackIndex: trackIdxRef.current,
    tracks:     tracksRef.current,
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
      {/* RNTPBridge only mounts in a real dev/production build where the
          native module exists. In Expo Go RNTP_AVAILABLE is false, so this
          component never renders and its hooks are never called. */}
      {RNTP_AVAILABLE && (
        <RNTPBridge onState={setRtpState} />
      )}
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider");
  return ctx;
}
