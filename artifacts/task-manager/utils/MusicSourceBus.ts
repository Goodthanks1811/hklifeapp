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

// Native-level audio-session watchdog for My Music & Apple Music.
// Registered by SpotifyPlayerContext (which has AppleMusicKit imported).
// startNativeWatchdog() fires a Swift Timer every 2 s that calls setActive(true)
// independently of the JS thread — survives iOS 26's tightened background grace period.
// stopNativeWatchdog() is called when Spotify takes over (keepalive handles it instead).
let _startWatchdog: KeepaliveFn | null = null;
let _stopWatchdog:  KeepaliveFn | null = null;

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

  // Registered by SpotifyPlayerContext on mount.
  registerStartWatchdog:   (fn: KeepaliveFn) => { _startWatchdog  = fn; },
  registerStopWatchdog:    (fn: KeepaliveFn) => { _stopWatchdog   = fn; },

  // Direct trigger — called from MusicPlayerContext / AppleMusicPlayerContext
  // when play/pause happens within the same source (no source switch involved).
  startWatchdog: () => { _startWatchdog?.(); },
  stopWatchdog:  () => { _stopWatchdog?.();  },

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
    // Start native watchdog so the session survives RNTP's nil-window deactivations.
    _startWatchdog?.();
  },

  notifyAppleMusicPlaying: () => {
    _appleMusicHasControl = true;
    _spotifyHasControl    = false;
    _pauseMyMusic?.();
    _pauseSpotify?.();
    // applicationQueuePlayer creates its own active session — keepalive not needed.
    _stopKeepalive?.();
    // Start native watchdog to keep the session alive in background.
    _startWatchdog?.();
  },

  notifySpotifyPlaying: () => {
    _appleMusicHasControl = false;
    _spotifyHasControl    = true;
    _pauseMyMusic?.();
    _pauseAppleMusic?.();
    // Stop the native watchdog before starting the keepalive — the keepalive
    // sets MixWithOthers; the watchdog must not call setActive after that to
    // avoid overriding Spotify's session configuration.
    _stopWatchdog?.();
    // Spotify audio lives in the Spotify app process (IPC only from our side).
    // Start silent keepalive so our process holds an AVAudioSession and survives
    // background / lock-screen without being killed by iOS memory pressure.
    _startKeepalive?.();
  },
};
