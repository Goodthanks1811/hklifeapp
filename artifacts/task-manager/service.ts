// Safe RNTP import — crashes in Expo Go if done via static ES import
let TrackPlayer: any = null;
let Event: any = {};

try {
  const rntp = require("react-native-track-player");
  TrackPlayer  = rntp.default ?? rntp;
  Event        = rntp.Event ?? {};
} catch {
  // Expo Go — native module not present
}

export async function PlaybackService() {
  if (!TrackPlayer) return;

  // ── Remote control events (Control Centre, Lock Screen, CarPlay) ─────────
  TrackPlayer.addEventListener(Event.RemotePlay,     () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause,    () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext,     () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek,     (e: any) => TrackPlayer.seekTo(e.position));
  TrackPlayer.addEventListener(Event.RemoteStop,     () => TrackPlayer.reset());

  // ── Audio session interruption handling (autoHandleInterruptions: false) ──
  // Fired when another app or system sound (e.g. Messages send swoosh,
  // phone call, Siri) temporarily takes the audio session.
  // paused=true  → interruption began  → we pause
  // paused=false → interruption ended  → resume only if it was NOT permanent
  TrackPlayer.addEventListener(Event.RemoteDuck, async (e: { paused: boolean; permanent: boolean }) => {
    try {
      if (e.paused) {
        await TrackPlayer.pause();
      } else if (!e.permanent) {
        await TrackPlayer.play();
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
