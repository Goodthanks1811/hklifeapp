type PauseFn = () => void;

let _pauseMyMusic:    PauseFn | null = null;
let _pauseAppleMusic: PauseFn | null = null;

// Tracks which source intentionally has the audio session.
// service.ts reads this to decide whether the RemoteDuck 10-second safety timer
// should fire: if Apple Music has deliberately taken control, RNTP must NOT
// auto-resume — that's what caused music to snap back after ~10 seconds.
let _appleMusicHasControl = false;

export const MusicSourceBus = {
  registerPauseMyMusic:    (fn: PauseFn) => { _pauseMyMusic    = fn; },
  registerPauseAppleMusic: (fn: PauseFn) => { _pauseAppleMusic = fn; },

  /** True when Apple Music intentionally holds the audio session. */
  appleMusicHasControl: () => _appleMusicHasControl,

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
