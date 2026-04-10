import { MusicSourceBus } from "@/utils/MusicSourceBus";

// Safe RNTP import — crashes in Expo Go if done via static ES import
let TrackPlayer: any = null;
let Event: any = {};
let State: any = {};
let RepeatMode: any = {};

try {
  const rntp = require("react-native-track-player");
  TrackPlayer  = rntp.default ?? rntp;
  Event        = rntp.Event ?? {};
  State        = rntp.State ?? {};
  RepeatMode   = rntp.RepeatMode ?? {};
} catch {
  // Expo Go — native module not present
}

export async function PlaybackService() {
  if (!TrackPlayer) return;

  // Tracks whether the user deliberately paused from the Lock Screen /
  // Control Centre. Prevents auto-resume after a permanent interruption ends.
  let userPaused = false;

  // ── Remote control events (Control Centre, Lock Screen, CarPlay) ─────────
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    userPaused = false;
    MusicSourceBus.setMyMusicUserPaused(false);
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    userPaused = true;
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteNext,     () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek,     (e: any) => TrackPlayer.seekTo(e.position));

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    userPaused = true;
    await TrackPlayer.reset();
    // reset() wipes RepeatMode back to Off — re-apply Queue so the next
    // play() call keeps the audio session alive indefinitely.
    try { await TrackPlayer.setRepeatMode(RepeatMode.Queue); } catch {}
  });

  // ── Audio session interruption handling (autoHandleInterruptions: false) ──
  //
  // RNTP's native configureAudioSession() deactivates the AVAudioSession when
  // currentItem == nil (track transitions, RepeatMode.Queue wrap-around).
  // iOS then gives a 30-second grace period before killing the process.
  // The watchdog below re-activates before that window closes.
  //
  // RemoteDuck rules:
  //   • Apple Music / Spotify took control → pause RNTP (source switch)
  //   • permanent=true, paused=true → phone call answered → pause
  //   • non-permanent (notifications, Siri) → do nothing.
  //     With DoNotMix the notification sound is suppressed; keeping RNTP
  //     playing means the session never goes truly idle.
  //   • paused=false (any interruption ended) → resume unless user paused
  TrackPlayer.addEventListener(Event.RemoteDuck, async (e: { paused: boolean; permanent: boolean }) => {
    try {
      if (e.paused) {
        if (MusicSourceBus.appleMusicHasControl() || MusicSourceBus.spotifyHasControl()) {
          await TrackPlayer.pause();
        } else if (e.permanent) {
          // Phone call — pause but don't mark as userPaused so watchdog / resume can recover
          await TrackPlayer.pause();
        }
        // Non-permanent: do nothing — DoNotMix suppresses the sound,
        // session stays active, iOS cannot kill the process
      } else {
        // Interruption ended (both permanent and non-permanent) — resume
        // if the user didn't deliberately press pause (from Lock Screen OR in-app)
        // and no other source is playing.
        if (!userPaused && !MusicSourceBus.myMusicUserPaused() && !MusicSourceBus.appleMusicHasControl() && !MusicSourceBus.spotifyHasControl()) {
          await TrackPlayer.play();
        }
      }
    } catch {
      // guard against stale state
    }
  });

  // ── Playback errors ───────────────────────────────────────────────────────
  TrackPlayer.addEventListener(Event.PlaybackError, (e: any) => {
    console.warn("[PlaybackService] Playback error:", e?.message ?? e);
  });

  // ── Background audio watchdog ─────────────────────────────────────────────
  //
  // Root cause: RNTP's native configureAudioSession() calls
  // audioSessionController.deactivateSession() whenever currentItem == nil.
  // This happens during track transitions and RepeatMode.Queue wrap-around.
  // Once deactivated, iOS starts a 30-second kill clock.
  //
  // Fix: every 15 seconds, if RNTP isn't playing (and the user didn't pause it
  // and no other source holds the session), call play() to re-activate the
  // audio session — well within the 30-second window.
  const watchdog = setInterval(async () => {
    if (userPaused || MusicSourceBus.myMusicUserPaused()) return;
    if (MusicSourceBus.appleMusicHasControl() || MusicSourceBus.spotifyHasControl()) {
      // Another source holds the audio session. Defensive: if RNTP somehow
      // auto-resumed (iOS delivering an interruption-ended signal despite
      // autoHandleInterruptions:false), re-pause it before its DoNotMix session
      // can cut off Apple Music or Spotify.
      try {
        const state = await TrackPlayer.getPlaybackState();
        const s = state?.state;
        if (s === State.Playing || s === State.Buffering) {
          await TrackPlayer.pause();
        }
      } catch {}
      return;
    }
    try {
      const state = await TrackPlayer.getPlaybackState();
      const s = state?.state;
      const isIdle = s === State.Paused || s === State.Stopped || s === State.Ready;
      if (!isIdle) return;
      // Only resume if there are tracks loaded — don't start from empty
      const queue = await TrackPlayer.getQueue();
      if (queue?.length > 0) {
        await TrackPlayer.play();
      }
    } catch {
      // RNTP not in a resumable state — do nothing
    }
  }, 15000);

  // Silence the TypeScript "unused variable" warning — the interval runs
  // forever in the background service and is cleaned up when the process dies.
  void watchdog;
}
