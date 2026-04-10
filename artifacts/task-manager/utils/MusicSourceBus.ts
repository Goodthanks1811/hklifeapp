type PauseFn  = () => void;
type ExpandFn = () => void;

let _pauseMyMusic:    PauseFn  | null = null;
let _pauseAppleMusic: PauseFn  | null = null;
let _pauseSpotify:    PauseFn  | null = null;
let _expandPlayer:    ExpandFn | null = null;

let _appleMusicHasControl = false;
let _spotifyHasControl    = false;

// Set to true when the user explicitly pauses My Music from inside the app
// (not from Lock Screen / Control Centre, which RNTP handles via RemotePause).
// Read by the PlaybackService watchdog and RemoteDuck handler so they don't
// automatically resume when the user meant to be paused.
let _myMusicUserPaused = false;

export const MusicSourceBus = {
  registerPauseMyMusic:    (fn: PauseFn)  => { _pauseMyMusic    = fn; },
  registerPauseAppleMusic: (fn: PauseFn)  => { _pauseAppleMusic = fn; },
  registerPauseSpotify:    (fn: PauseFn)  => { _pauseSpotify    = fn; },
  registerExpand:          (fn: ExpandFn) => { _expandPlayer    = fn; },

  appleMusicHasControl: () => _appleMusicHasControl,
  spotifyHasControl:    () => _spotifyHasControl,

  setMyMusicUserPaused: (v: boolean) => { _myMusicUserPaused = v; },
  myMusicUserPaused:    () => _myMusicUserPaused,

  triggerExpand: () => { _expandPlayer?.(); },

  notifyMyMusicPlaying: () => {
    _appleMusicHasControl = false;
    _spotifyHasControl    = false;
    _myMusicUserPaused    = false;
    _pauseAppleMusic?.();
    _pauseSpotify?.();
  },

  notifyAppleMusicPlaying: () => {
    _appleMusicHasControl = true;
    _spotifyHasControl    = false;
    _pauseMyMusic?.();
    _pauseSpotify?.();
  },

  notifySpotifyPlaying: () => {
    _appleMusicHasControl = false;
    _spotifyHasControl    = true;
    _pauseMyMusic?.();
    _pauseAppleMusic?.();
  },
};
