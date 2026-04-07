import { requireNativeModule } from "expo-modules-core";

// AppleMusicKitModule is an ExpoModulesCore Swift module compiled into the
// native (ad-hoc) build. requireNativeModule throws in Expo Go (where the
// Swift code isn't compiled), which music-apple.tsx catches to show the
// "Install Required" state. In the real native build, this returns the module.
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
