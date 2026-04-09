import { MusicSourceBus } from "@/utils/MusicSourceBus";

// Safe RNTP import — crashes in Expo Go if done via static ES import
let TrackPlayer: any = null;
let Event: any = {};
let State: any = {};

try {
  const rntp = require("react-native-track-player");
  TrackPlayer  = rntp.default ?? rntp;
  Event        = rntp.Event ?? {};
  State        = rntp.State ?? {};
} catch {
  // Expo Go — native module not present
}

export async function PlaybackService() {
  if (!TrackPlayer) return;

  // Tracks whether the user deliberately paused from the Lock Screen /
  // Control Centre. Used by the RemoteDuck safety-net to avoid auto-resuming
  // after a system-ducking event when the user actually wanted silence.
  let userPaused = false;

  // Safety-net timer for RemoteDuck: if the OS fires paused=true but never
  // fires the matching paused=false resume event (an iOS 26 beta bug), music
  // stays paused indefinitely. We wait 10 s then force-resume — unless the
  // user explicitly paused via the Lock Screen button.
  let duckResumeTimer: ReturnType<typeof setTimeout> | null = null;

  const clearDuckTimer = () => {
    if (duckResumeTimer) { clearTimeout(duckResumeTimer); duckResumeTimer = null; }
  };

  // ── Remote control events (Control Centre, Lock Screen, CarPlay) ─────────
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    userPaused = false;
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    userPaused = true;
    clearDuckTimer(); // user paused intentionally — cancel any pending auto-resume
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteNext,     () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek,     (e: any) => TrackPlayer.seekTo(e.position));
  TrackPlayer.addEventListener(Event.RemoteStop,     () => { userPaused = true; clearDuckTimer(); TrackPlayer.reset(); });

  // ── Audio session interruption handling (autoHandleInterruptions: false) ──
  // Fired when another app or system sound (notification, phone call, Siri)
  // temporarily takes the audio session.
  //
  // paused=true  → interruption began → pause + start 10 s safety timer
  // paused=false → interruption ended → clear timer and resume (if non-permanent)
  //
  // The safety timer handles iOS 26's bug where the paused=false resume event
  // is sometimes never fired, leaving music permanently paused in the background.
  TrackPlayer.addEventListener(Event.RemoteDuck, async (e: { paused: boolean; permanent: boolean }) => {
    try {
      if (e.paused) {
        await TrackPlayer.pause();

        // Only auto-recover if the user hasn't deliberately paused AND Apple Music
        // hasn't intentionally taken the audio session (MusicSourceBus switch).
        // Without this guard, switching to Apple Music triggers RemoteDuck and the
        // 10-second timer fires — resuming RNTP and overriding Apple Music playback.
        if (!userPaused && !MusicSourceBus.appleMusicHasControl()) {
          clearDuckTimer();
          duckResumeTimer = setTimeout(async () => {
            duckResumeTimer = null;
            try {
              // Verify we're still paused (not playing, not already recovered)
              const s = await TrackPlayer.getPlaybackState();
              if (s?.state !== State.Playing && s?.state !== State.Buffering) {
                await TrackPlayer.play();
              }
            } catch {
              // player gone — ignore
            }
          }, 10_000);
        }
      } else if (!e.permanent && !MusicSourceBus.appleMusicHasControl()) {
        // Interruption ended (e.g. notification sound finished) — resume RNTP.
        // Guard: if Apple Music intentionally holds the session, don't steal it back.
        clearDuckTimer();
        userPaused = false;
        await TrackPlayer.play();
      } else {
        // permanent=true means another app fully took over (e.g. phone call
        // that the user answered). Clear the timer but don't auto-resume.
        clearDuckTimer();
      }
    } catch {
      // guard against stale state after interruption
    }
  });

  // ── Playback errors ───────────────────────────────────────────────────────
  // Without this handler an unhandled native error can bubble up and crash.
  TrackPlayer.addEventListener(Event.PlaybackError, (e: any) => {
    console.warn("[PlaybackService] Playback error:", e?.message ?? e);
  });
}
