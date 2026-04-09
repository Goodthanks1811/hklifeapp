type PauseFn  = () => void;
type ExpandFn = () => void;

let _pauseMyMusic:    PauseFn  | null = null;
let _pauseAppleMusic: PauseFn  | null = null;
let _expandPlayer:    ExpandFn | null = null;

// Tracks which source intentionally has the audio session.
// service.ts reads this to decide whether the RemoteDuck 10-second safety timer
// should fire: if Apple Music has deliberately taken control, RNTP must NOT
// auto-resume — that's what caused music to snap back after ~10 seconds.
let _appleMusicHasControl = false;

export const MusicSourceBus = {
  registerPauseMyMusic:    (fn: PauseFn)  => { _pauseMyMusic    = fn; },
  registerPauseAppleMusic: (fn: PauseFn)  => { _pauseAppleMusic = fn; },
  /** Call from GlobalMusicPlayer so any screen can open the full-screen player */
  registerExpand:          (fn: ExpandFn) => { _expandPlayer    = fn; },

  /** True when Apple Music intentionally holds the audio session. */
  appleMusicHasControl: () => _appleMusicHasControl,

  /** Open the full-screen now-playing sheet (called from music-apple / music-mymusic) */
  triggerExpand: () => { _expandPlayer?.(); },

  /** Call when My Music is about to start — silences Apple Music */
  notifyMyMusicPlaying: () => {
    _appleMusicHasControl = false;
    _pauseAppleMusic?.();
  },

  /** Call when Apple Music is about to start — silences My Music */
  notifyAppleMusicPlaying: () => {
    _appleMusicHasControl = true;
    _pauseMyMusic?.();
  },
};
