type PauseFn     = () => void;
type ExpandFn    = () => void;
type KeepaliveFn = () => void;

let _pauseMyMusic:    PauseFn     | null = null;
let _pauseAppleMusic: PauseFn     | null = null;
let _pauseSpotify:    PauseFn     | null = null;
let _expandPlayer:    ExpandFn    | null = null;

// Silent PCM keepalive — runs alongside EVERY active source.
//
// iOS 26 checks for actual audio-buffer output, not just an active session flag.
// Calling setActive(true) on a timer is not sufficient — iOS can still kill the
// process if no audio frames are flowing.  The silent AVAudioEngine (0-amplitude
// PCM, MixWithOthers) feeds real frames to the audio graph, satisfying the OS
// check and keeping our process alive through track transitions, lock-screen
// suspension, and any brief session deactivation from RNTP or the system.
//
// Previously this was only used for Spotify (where we produce no audio ourselves).
// It now runs for ALL three sources as a universal background-survival layer.
let _startKeepalive: KeepaliveFn | null = null;
let _stopKeepalive:  KeepaliveFn | null = null;

// Secondary guard — Swift Timer calls setActive(true) every 2 s independently
// of the JS thread.  Kept as a belt-and-suspenders complement to the keepalive;
// the keepalive is the primary mechanism.
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

  registerStartKeepalive:  (fn: KeepaliveFn) => { _startKeepalive = fn; },
  registerStopKeepalive:   (fn: KeepaliveFn) => { _stopKeepalive  = fn; },

  registerStartWatchdog:   (fn: KeepaliveFn) => { _startWatchdog  = fn; },
  registerStopWatchdog:    (fn: KeepaliveFn) => { _stopWatchdog   = fn; },

  startWatchdog: () => { _startWatchdog?.(); },
  stopWatchdog:  () => { _stopWatchdog?.();  },

  // Stop both keepalive and watchdog — call when the user intentionally pauses
  // ALL music and wants the process to go fully silent in the background.
  stopAllKeepAlive: () => {
    _stopKeepalive?.();
    _stopWatchdog?.();
  },

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
    // Run the silent PCM engine alongside RNTP.  RNTP briefly deactivates the
    // AVAudioSession when its queue item is nil (track gap).  The silent engine
    // keeps real audio frames flowing through that window so iOS never sees a
    // fully-quiet process and doesn't kill us.
    _startKeepalive?.();
    // Belt-and-suspenders: native watchdog re-calls setActive(true) every 2 s
    // in case RNTP resets the category without MixWithOthers.
    _startWatchdog?.();
  },

  notifyAppleMusicPlaying: () => {
    _appleMusicHasControl = true;
    _spotifyHasControl    = false;
    _pauseMyMusic?.();
    _pauseSpotify?.();
    // IMPORTANT: Do NOT start the silent keepalive for Apple Music.
    // The keepalive sets the audio session to MixWithOthers, which conflicts with
    // applicationQueuePlayer's FairPlay DRM decryption — Apple Music catalog content
    // requires an exclusive (DoNotMix) session, and MixWithOthers silently prevents
    // prepareToPlay from succeeding.
    // applicationQueuePlayer produces its own audio frames, so the process doesn't
    // need the keepalive for background survival anyway.
    // If the keepalive was running (e.g. from a previous RNTP or Spotify session),
    // stop it so the session is exclusively owned by Apple Music.
    _stopKeepalive?.();
    // The native watchdog (setActive every 2s) is safe and keeps the session alive
    // through any brief interruptions without touching the session category.
    _startWatchdog?.();
  },

  notifySpotifyPlaying: () => {
    _appleMusicHasControl = false;
    _spotifyHasControl    = true;
    _pauseMyMusic?.();
    _pauseAppleMusic?.();
    // Spotify audio lives in the Spotify app process (IPC only from our side).
    // The silent engine is the ONLY audio our process produces — essential.
    // Watchdog is harmless here but not required; stop it to avoid any
    // setActive race with the keepalive's MixWithOthers configuration.
    _stopWatchdog?.();
    _startKeepalive?.();
  },
};
