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
