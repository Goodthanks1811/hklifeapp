import { requireNativeModule } from "expo-modules-core";

// AppleMusicKit is only compiled into the native (ad-hoc) build.
// Throwing here causes the require() in music-apple.tsx to fail gracefully
// and show the "Install Required" state in Expo Go / Android.
const AM = requireNativeModule("AppleMusicKit");

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
  return AM.requestAuthorization() as Promise<AuthStatus>;
}

export function getPlaylists(): Promise<ApplePlaylist[]> {
  return AM.getPlaylists();
}

export function playPlaylist(id: string): Promise<void> {
  return AM.playPlaylist(id);
}
