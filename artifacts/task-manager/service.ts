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
  TrackPlayer.addEventListener(Event.RemotePlay,     () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause,    () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext,     () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek,     (e: any) => TrackPlayer.seekTo(e.position));
  TrackPlayer.addEventListener(Event.RemoteStop,     () => TrackPlayer.reset());
}
