import { NativeModules } from "react-native";

// AppleMusicKit is only compiled into the native (ad-hoc) build.
// Throwing here causes the require() in music-apple.tsx to fail gracefully
// and show the "Install Required" state in Expo Go / Android.
const AM = NativeModules.AppleMusicKit as {
  requestAuthorization(): Promise<string>;
  getPlaylists(): Promise<Array<{ id: string; name: string; count: number }>>;
  playPlaylist(id: string): Promise<void>;
} | null | undefined;

if (!AM) {
  throw new Error("AppleMusicKit native module is not available in this environment");
}

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
  return AM!.requestAuthorization() as Promise<AuthStatus>;
}

export function getPlaylists(): Promise<ApplePlaylist[]> {
  return AM!.getPlaylists();
}

export function playPlaylist(id: string): Promise<void> {
  return AM!.playPlaylist(id);
}
