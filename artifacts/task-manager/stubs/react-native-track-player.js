// No-op stub for react-native-track-player on web / Expo Go canvas preview.
// The real native module only exists in EAS / development builds.
const noop = () => Promise.resolve();
const noopSync = () => {};

const TrackPlayer = {
  registerPlaybackService: noopSync,
  setupPlayer:     noop,
  updateOptions:   noop,
  add:             noop,
  reset:           noop,
  play:            noop,
  pause:           noop,
  stop:            noop,
  skip:            noop,
  skipToNext:      noop,
  skipToPrevious:  noop,
  seekTo:          noop,
  addEventListener: noopSync,
};

module.exports = TrackPlayer;
module.exports.default = TrackPlayer;
module.exports.Capability = {};
module.exports.State = {};
module.exports.Event = {};
module.exports.useActiveTrack   = () => null;
module.exports.usePlaybackState = () => ({ state: null });
module.exports.useProgress      = () => ({ position: 0, duration: 0, buffered: 0 });
