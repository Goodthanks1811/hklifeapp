type PauseFn     = () => void;
type ExpandFn    = () => void;
type KeepaliveFn = () => void;

let _pauseMyMusic:    PauseFn     | null = null;
let _pauseAppleMusic: PauseFn     | null = null;
let _pauseSpotify:    PauseFn     | null = null;
let _expandPlayer:    ExpandFn    | null = null;

// Called when Spotify becomes the active source → starts silent background
// audio keepalive so our process survives the phone being locked.
// Called when another source takes over → stops the keepalive.
let _startKeepalive: KeepaliveFn | null = null;
let _stopKeepalive:  KeepaliveFn | null = null;

let _appleMusicHasControl = false;
let _spotifyHasControl    = false;

// Set to true when the user explicitly pauses My Music from inside the app
// (not from Lock Screen / Control Centre, which RNTP handles via RemotePause).
// Read by the PlaybackService watchdog and RemoteDuck handler so they don't
// automatically resume when the user meant to be paused.
let _myMusicUserPaused = false;

export const MusicSourceBus = {
  registerPauseMyMusic:    (fn: PauseFn)     => { _pauseMyMusic    = fn; },
  registerPauseAppleMusic: (fn: PauseFn)     => { _pauseAppleMusic = fn; },
  registerPauseSpotify:    (fn: PauseFn)     => { _pauseSpotify    = fn; },
  registerExpand:          (fn: ExpandFn)    => { _expandPlayer    = fn; },

  // Registered by SpotifyPlayerContext on mount so it can wire the native
  // AppleMusicKit keepalive without creating a circular import.
  registerStartKeepalive:  (fn: KeepaliveFn) => { _startKeepalive = fn; },
  registerStopKeepalive:   (fn: KeepaliveFn) => { _stopKeepalive  = fn; },

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
    // RNTP will own the audio session — keepalive not needed.
    _stopKeepalive?.();
  },

  notifyAppleMusicPlaying: () => {
    _appleMusicHasControl = true;
    _spotifyHasControl    = false;
    _pauseMyMusic?.();
    _pauseSpotify?.();
    // applicationQueuePlayer creates its own active session — keepalive not needed.
    _stopKeepalive?.();
  },

  notifySpotifyPlaying: () => {
    _appleMusicHasControl = false;
    _spotifyHasControl    = true;
    _pauseMyMusic?.();
    _pauseAppleMusic?.();
    // Spotify audio lives in the Spotify app process (IPC only from our side).
    // Start silent keepalive so our process holds an AVAudioSession and survives
    // background / lock-screen without being killed by iOS memory pressure.
    _startKeepalive?.();
  },
};
