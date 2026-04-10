import { requireNativeModule } from "expo-modules-core";

const AM = requireNativeModule("AppleMusicKit");

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
  return AM.requestAuthorization() as Promise<AuthStatus>;
}

export function getPlaylists(): Promise<ApplePlaylist[]> {
  return AM.getPlaylists();
}

export function getSongsInPlaylist(playlistId: string): Promise<AppleSong[]> {
  return AM.getSongsInPlaylist(playlistId);
}

export function playPlaylist(id: string): Promise<void> {
  return AM.playPlaylist(id);
}

export function playSongInPlaylist(playlistId: string, songIndex: number): Promise<void> {
  return AM.playSongInPlaylist(playlistId, songIndex);
}

export function pause(): Promise<void> {
  return AM.pause();
}

export function resumePlay(): Promise<void> {
  return AM.resumePlay();
}

export function skipToNext(): Promise<void> {
  return AM.skipToNext();
}

export function skipToPrevious(): Promise<void> {
  return AM.skipToPrevious();
}

export function getCurrentTime(): Promise<number> {
  return AM.getCurrentTime();
}

export function getDuration(): Promise<number> {
  return AM.getDuration();
}

export function seekTo(time: number): Promise<void> {
  return AM.seekTo(time);
}

export function setVolume(volume: number): Promise<void> {
  return AM.setVolume(volume);
}

export function getHKArtworkFileURI(): Promise<string> {
  return AM.getHKArtworkFileURI();
}

export function startSilentKeepAlive(): Promise<void> {
  return AM.startSilentKeepAlive();
}

export function stopSilentKeepAlive(): Promise<void> {
  return AM.stopSilentKeepAlive();
}

export function isPlayingNative(): Promise<boolean> {
  return AM.isPlayingNative();
}

export function startNativeWatchdog(): Promise<void> {
  return AM.startNativeWatchdog();
}

export function stopNativeWatchdog(): Promise<void> {
  return AM.stopNativeWatchdog();
}
