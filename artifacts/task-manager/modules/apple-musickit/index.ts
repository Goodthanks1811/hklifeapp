import { NativeModules } from "react-native";

// AppleMusicKit is an ObjC bridge module (RCT_EXPORT_MODULE) — it
// self-registers via the ObjC runtime and is accessed through NativeModules,
// NOT requireNativeModule (which requires an ExpoModulesProvider entry).
//
// In Expo Go or any build without the compiled native module,
// NativeModules.AppleMusicKit will be undefined, and the throw below causes
// music-apple.tsx's require() catch to set AppleMusicKit = null, showing
// the "Install Required" state.
const AM = NativeModules.AppleMusicKit;

if (!AM) {
  throw new Error("AppleMusicKit native module not available (Expo Go or simulator)");
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
  return AM.requestAuthorization() as Promise<AuthStatus>;
}

export function getPlaylists(): Promise<ApplePlaylist[]> {
  return AM.getPlaylists();
}

export function playPlaylist(id: string): Promise<void> {
  return AM.playPlaylist(id);
}
