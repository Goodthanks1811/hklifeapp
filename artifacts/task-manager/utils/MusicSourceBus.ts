type PauseFn     = () => void;
type ExpandFn    = () => void;
type KeepaliveFn = () => void;

let _pauseMyMusic:    PauseFn     | null = null;
let _pauseAppleMusic: PauseFn     | null = null;
let _pauseSpotify:    PauseFn     | null = null;
let _expandPlayer:    ExpandFn    | null = null;

// Silent PCM keepalive — used ONLY when Spotify is the active source.
//
// When Spotify plays, audio lives in the Spotify app process (IPC from our side).
// Our process has no audio session of its own, so iOS can suspend/kill it.
// The silent AVAudioEngine (0-amplitude PCM, MixWithOthers) keeps a live
// AVAudioSession in our process without interfering with Spotify's audio.
//
// The keepalive must NOT run alongside RNTP (My Music) or applicationQueuePlayer
// (Apple Music).  MixWithOthers conflicts with RNTP's DoNotMix session and can
// knock RNTP out of a playing state during track transitions, causing background
// audio to die when the phone is locked.  Both RNTP and applicationQueuePlayer
// produce their own audio and hold the session natively; they do not need this.
let _startKeepalive: KeepaliveFn | null = null;
let _stopKeepalive:  KeepaliveFn | null = null;

// Native watchdog — Swift Timer calls setActive(true) every 2 s independently
// of the JS thread.  Primary background-survival mechanism for My Music (RNTP)
// and Apple Music (applicationQueuePlayer).  Fires even when JS is suspended.
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

  // Pause every active source at once and prevent watchdogs from auto-resuming.
  // Called when an audio output device is removed (CarPlay disconnect, headphone
  // unplug, AirPods out of range) so music stops regardless of which source is
  // currently playing.  Each individual pause fn also sets its own userPausedRef.
  pauseAll: () => {
    _myMusicUserPaused = true;   // prevents the RNTP watchdog from auto-resuming
    _pauseMyMusic?.();
    _pauseAppleMusic?.();
    _pauseSpotify?.();
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
    // Stop the silent PCM keepalive if it was running from a previous Spotify
    // session.  The keepalive uses MixWithOthers, which conflicts with RNTP's
    // DoNotMix session — they fight over the AVAudioSession and the keepalive
    // can knock RNTP out of a playing state during track transitions, causing
    // background audio to die.  RNTP (with RepeatMode.Queue) produces its own
    // continuous audio and holds the session natively; it does not need the
    // keepalive the way Spotify does.
    _stopKeepalive?.();
    // Native watchdog re-calls setActive(true) every 2 s at the Swift level,
    // independent of the JS thread — keeps the session alive through any brief
    // deactivation during RNTP track transitions without touching the category.
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
    // Do NOT start the native watchdog for Apple Music.
    // applicationQueuePlayer manages its own audio session natively.
    // Calling setActive(true) every 2s from our watchdog interferes with
    // the FairPlay DRM session and causes applicationQueuePlayer to stop
    // ~2 seconds after play() is called. The watchdog is only for RNTP
    // (My Music), where it defends against RNTP's own deactivateSession()
    // calls during track transitions.
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
