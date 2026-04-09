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
  // Root cause of background audio dropout:
  // When any notification/sound fires RemoteDuck with paused=true, the old code
  // paused RNTP and waited 10 seconds to resume. During that 10-second window the
  // audio session went idle, iOS removed the background-audio privilege, and killed
  // the process — stopping music and forcing a fresh app launch (Face ID prompt).
  //
  // Fix: only pause for events that truly require it:
  //   • permanent=true  → phone call answered — pause (user expects silence)
  //   • Apple Music taking control → pause RNTP (source switch)
  //   • non-permanent (notifications, Siri brief) → do nothing.
  //     With DoNotMix, notification sounds are already suppressed by iOS when
  //     we hold the audio session. Keeping RNTP playing means the session never
  //     goes idle and iOS never kills the background process.
  TrackPlayer.addEventListener(Event.RemoteDuck, async (e: { paused: boolean; permanent: boolean }) => {
    try {
      if (e.paused) {
        if (MusicSourceBus.appleMusicHasControl()) {
          // Apple Music intentionally took the session — silence RNTP
          await TrackPlayer.pause();
        } else if (e.permanent) {
          // Permanent interruption (e.g. answered phone call) — pause
          // without marking userPaused so we resume when the call ends
          await TrackPlayer.pause();
        }
        // Non-permanent system interruption (notification, Siri, etc.):
        // do nothing — audio session stays active, iOS cannot kill the process
      } else if (!e.permanent && !userPaused && !MusicSourceBus.appleMusicHasControl()) {
        // Interruption ended — resume if the user didn't deliberately pause
        await TrackPlayer.play();
      }
    } catch {
      // guard against stale state
    }
  });

  // ── Playback errors ───────────────────────────────────────────────────────
  TrackPlayer.addEventListener(Event.PlaybackError, (e: any) => {
    console.warn("[PlaybackService] Playback error:", e?.message ?? e);
  });
}
