import { requireOptionalNativeModule, EventEmitter } from "expo-modules-core";
import type { Subscription } from "expo-modules-core";

// requireOptionalNativeModule returns null instead of throwing when the native
// module isn't present (Expo Go, simulators without the native build).
// All exported functions guard against a null AM so the app doesn't crash.
const AM      = requireOptionalNativeModule("AppleMusicKit");
const emitter = AM ? new EventEmitter(AM) : null;

export type ApplePlaylist = {
  id: string;
  name: string;
  count: number;
};

export type AppleSong = {
  id: string;
  title: string;
  artist: string;
  albumTitle: string;
  duration: number;
};

export type AuthStatus =
  | "authorized"
  | "denied"
  | "restricted"
  | "notDetermined";

export function requestAuthorization(): Promise<AuthStatus> {
  return AM?.requestAuthorization() ?? Promise.resolve("denied" as AuthStatus);
}

export function getPlaylists(): Promise<ApplePlaylist[]> {
  return AM?.getPlaylists() ?? Promise.resolve([]);
}

export function getSongsInPlaylist(playlistId: string): Promise<AppleSong[]> {
  return AM?.getSongsInPlaylist(playlistId) ?? Promise.resolve([]);
}

export function playPlaylist(id: string): Promise<void> {
  return AM?.playPlaylist(id) ?? Promise.resolve();
}

export function playSongInPlaylist(playlistId: string, songIndex: number): Promise<void> {
  return AM?.playSongInPlaylist(playlistId, songIndex) ?? Promise.resolve();
}

export function pause(): Promise<void> {
  return AM?.pause() ?? Promise.resolve();
}

export function resumePlay(): Promise<void> {
  return AM?.resumePlay() ?? Promise.resolve();
}

export function skipToNext(): Promise<void> {
  return AM?.skipToNext() ?? Promise.resolve();
}

export function skipToPrevious(): Promise<void> {
  return AM?.skipToPrevious() ?? Promise.resolve();
}

export function getCurrentTime(): Promise<number> {
  return AM?.getCurrentTime() ?? Promise.resolve(0);
}

export function getDuration(): Promise<number> {
  return AM?.getDuration() ?? Promise.resolve(0);
}

export function seekTo(time: number): Promise<void> {
  return AM?.seekTo(time) ?? Promise.resolve();
}

export function setVolume(volume: number): Promise<void> {
  return AM?.setVolume(volume) ?? Promise.resolve();
}

export function getHKArtworkFileURI(): Promise<string> {
  return AM?.getHKArtworkFileURI() ?? Promise.resolve("");
}

export function startSilentKeepAlive(): Promise<void> {
  return AM?.startSilentKeepAlive() ?? Promise.resolve();
}

export function stopSilentKeepAlive(): Promise<void> {
  return AM?.stopSilentKeepAlive() ?? Promise.resolve();
}

export function isPlayingNative(): Promise<boolean> {
  return AM?.isPlayingNative() ?? Promise.resolve(false);
}

export function startNativeWatchdog(): Promise<void> {
  return AM?.startNativeWatchdog() ?? Promise.resolve();
}

export function stopNativeWatchdog(): Promise<void> {
  return AM?.stopNativeWatchdog() ?? Promise.resolve();
}

// ── Audio route change event ──────────────────────────────────────────────────
// Fires when an audio output device is removed (CarPlay disconnects, headphones
// unplugged, AirPods go out of range, etc.).  Subscribe to pause all sources.
export function addAudioOutputLostListener(callback: () => void): Subscription | null {
  return emitter?.addListener("onAudioOutputLost", callback) ?? null;
}

// ── Play-failed diagnostic event ─────────────────────────────────────────────
// Fires ~1.5 s after playSongInPlaylist() if the native player is not in
// .playing state — surfaces silent play() failures (iOS 26 DRM, session issues).
export function addPlayFailedListener(
  callback: (e: { reason: string; stateRaw: number }) => void
): Subscription | null {
  return emitter?.addListener("appleMusicPlayFailed", callback) ?? null;
}
