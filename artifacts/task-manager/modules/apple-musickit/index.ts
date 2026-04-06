import { requireNativeModule } from "expo-modules-core";

const AppleMusicKit = requireNativeModule("AppleMusicKit");

export type ApplePlaylist = {
  id: string;
  name: string;
  count: number;
};

export type AuthStatus =
  | "authorized"
  | "denied"
  | "restricted"
  | "notDetermined";

export function requestAuthorization(): Promise<AuthStatus> {
  return AppleMusicKit.requestAuthorization();
}

export function getPlaylists(): Promise<ApplePlaylist[]> {
  return AppleMusicKit.getPlaylists();
}

export function playPlaylist(id: string): Promise<void> {
  return AppleMusicKit.playPlaylist(id);
}
