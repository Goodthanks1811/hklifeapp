type PauseFn = () => void;

let _pauseMyMusic:    PauseFn | null = null;
let _pauseAppleMusic: PauseFn | null = null;

export const MusicSourceBus = {
  registerPauseMyMusic:    (fn: PauseFn) => { _pauseMyMusic    = fn; },
  registerPauseAppleMusic: (fn: PauseFn) => { _pauseAppleMusic = fn; },

  /** Call when My Music is about to start — silences Apple Music */
  notifyMyMusicPlaying:    () => { _pauseAppleMusic?.(); },
  /** Call when Apple Music is about to start — silences My Music */
  notifyAppleMusicPlaying: () => { _pauseMyMusic?.(); },
};
