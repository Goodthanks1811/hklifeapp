# EAS Build Guide — HK Life App

A record of every build issue encountered and how to resolve it.

---

## How to Trigger a Build

Run this from inside `artifacts/task-manager/` (check your shell prompt first — if it already shows `artifacts/task-manager`, skip the `cd`):

```bash
cd artifacts/task-manager
NODE_PATH=/home/runner/workspace/artifacts/task-manager/node_modules \
  EAS_NO_VCS=1 \
  EAS_SKIP_AUTO_FINGERPRINT=1 \
  eas build --platform ios --profile preview --non-interactive
```

- `NODE_PATH` — lets the EAS CLI resolve `expo-router` and other local packages
- `EAS_NO_VCS=1` — skips the Git check (Replit's VCS integration isn't compatible)
- `EAS_SKIP_AUTO_FINGERPRINT=1` — prevents the fingerprint step from stalling
- `--non-interactive` — required in CI/shell environments

When done, Expo emails you the IPA link and it also appears at expo.dev → your project → Builds.

---

## Issues Encountered & Fixes

### 1. `Failed to resolve plugin for module "expo-router"`

**When it appears**: When running `eas build` without the `NODE_PATH` prefix.

**Cause**: The EAS CLI evaluates `app.config.js` to resolve plugins. `expo-router` is only installed in `artifacts/task-manager/node_modules/`, not at the root workspace level, so the CLI can't find it.

**Fix**: Always prefix the `eas build` command with:
```
NODE_PATH=/home/runner/workspace/artifacts/task-manager/node_modules
```

---

### 2. `cd: artifacts/task-manager: No such file or directory`

**When it appears**: Running the full `cd artifacts/task-manager && eas build ...` command when you're already inside `artifacts/task-manager`.

**Cause**: The shell is already in the right directory. Running `cd artifacts/task-manager` from inside it fails because the path doesn't exist relative to the current location.

**Fix**: Check your shell prompt. If it shows `artifacts/task-manager`, skip the `cd` and run just the `eas build` command.

---

### 3. pnpm frozen lockfile mismatch

**Error message**:
```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
pnpm-lock.yaml is not up to date with artifacts/task-manager/package.json
specifiers in the lockfile don't match specifiers in package.json
```

**Cause**: EAS detects the root `pnpm-workspace.yaml` and runs `pnpm install --frozen-lockfile`. If `package.json` was changed (e.g. a version pinned) but `pnpm-lock.yaml` wasn't updated, they go out of sync.

**Fix**: After any version change in `artifacts/task-manager/package.json`, run from the repo root:
```bash
pnpm install --no-frozen-lockfile
```
Then verify with:
```bash
grep -A2 "react-native-keyboard-controller:" pnpm-lock.yaml | head -4
```
Commit both `package.json` and `pnpm-lock.yaml`.

**Important**: Running `pnpm install` wipes `node_modules`. If workflows break afterwards, restart them and they will reinstall automatically.

---

### 4. App starts and immediately exits on device

**Cause**: A native module version mismatch. In our case, `react-native-keyboard-controller` was on `1.21.2` but Expo 54 / React Native 0.81 requires `1.18.5`. The wrong native binary crashes the app before JS even loads.

**Fix**: Pin the package exactly in `package.json` (no `^` or `~`):
```json
"react-native-keyboard-controller": "1.18.5"
```
Then update both lockfiles:
```bash
# Update npm lockfile (used by EAS)
cd artifacts/task-manager
npm install --package-lock-only

# Update pnpm lockfile (detected by EAS)
cd ../..
pnpm install --no-frozen-lockfile
```
Then rebuild.

**General rule**: When Expo's compatibility check prints a warning like:
```
react-native-keyboard-controller@1.21.2 - expected version: 1.18.5
```
...treat it as a hard error for native builds, not just a warning. Fix it before building.

---

### 5. App force quits immediately — Face ID crash

**Symptom**: App opens, splash screen briefly appears, then the app is killed by iOS before anything renders.

**Cause**: iOS immediately terminates any app that calls the `LocalAuthentication` framework API (including just checking if biometrics are available) without `NSFaceIDUsageDescription` in `Info.plist`. The `BiometricProvider` calls `hasHardwareAsync()` the instant the app mounts — on any Face ID-capable device this triggers the OS kill.

**Fix**: Add the usage description to `app.config.js` under `ios.infoPlist`:
```js
infoPlist: {
  ITSAppUsesNonExemptEncryption: false,
  NSFaceIDUsageDescription: 'HK Life uses Face ID to lock the app.',
},
```
This is now in place. If you ever remove `expo-local-authentication`, this key can be removed too — but as long as biometric lock exists, it must be there.

**Note**: This does NOT crash in Expo Go because Expo Go provides its own `NSFaceIDUsageDescription`. It only crashes in native builds.

---

### 6. App force quits — unused native package auto-linked

**Symptom**: App crashes on launch with no clear JS error.

**Cause**: `expo-glass-effect` was in `package.json` but never imported in the app. Because it has an `expo-module.config.json` with a native Swift module (`GlassEffectModule`), Expo auto-links it into every native build. With `newArchEnabled: true`, unverified packages that haven't been updated for the new architecture can crash on startup during native module initialization.

**Fix**: Removed `expo-glass-effect` from `package.json` entirely since it was unused. Updated both `package-lock.json` and `pnpm-lock.yaml`.

**General rule**: Any package with an `expo-module.config.json` and an `ios/` folder gets auto-linked and its native code runs on every launch, even if you never import it in JS. Remove unused native packages.

---

### 7. App crashes in JS thread on launch — react-native-keyboard-controller on iOS 26

**Symptom**: `EXC_BAD_ACCESS (SIGSEGV)` at an unmapped address on thread `com.facebook.react.runtime.JavaScript`. App exits ~0.12 seconds after launch.

**Crash log key fields**:
```
"exception": {"type": "EXC_BAD_ACCESS", "signal": "SIGSEGV", "subtype": "KERN_INVALID_ADDRESS at 0x0000000468d53fc8"}
"legacyInfo": {"threadTriggered": {"name": "com.facebook.react.runtime.JavaScript"}}
```

**Cause**: `react-native-keyboard-controller` uses JSI (JavaScript Interface) bindings to hook into UIKeyboard internals. iOS 26 significantly changed UIKeyboard APIs, causing a use-after-free when keyboard-controller's JSI bindings initialize. The `KeyboardProvider` component mounts at app root (`_layout.tsx`), so this crashes on every launch.

**Diagnosis**: The crash address (`0x468d53fc8`) falls in a memory gap between regions — classic use-after-free pattern. The faulting thread (`com.facebook.react.runtime.JavaScript`) confirms the crash happens when JS executes `KeyboardProvider`'s native module setup.

**Fix applied**: Removed `react-native-keyboard-controller` entirely since no hooks (`useKeyboardAnimation`, etc.) were actually used — only `KeyboardProvider` was present as an unused wrapper. Removed:
1. `import { KeyboardProvider }` from `_layout.tsx`
2. `<KeyboardProvider>` wrapper from the component tree
3. `"react-native-keyboard-controller"` from `package.json`

**Rule**: `react-native-keyboard-controller` is permanently removed. Use `Keyboard.addListener` + `Animated.Value` (no native driver) for keyboard handling.

---

### 8. App crashes on launch — iOS 26 TurboModule incompatibility

**Symptom**: `EXC_BAD_ACCESS (SIGSEGV)` at address `0x0000800000000097` on thread `com.meta.react.turbomodulemanager.queue`. App exits immediately with no UI.

**Crash log key fields**:
```
"exception": {"type": "EXC_BAD_ACCESS", "signal": "SIGSEGV", "subtype": "KERN_INVALID_ADDRESS at 0x0000800000000097"}
"legacyInfo": {"threadTriggered": {"queue": "com.meta.react.turbomodulemanager.queue"}}
"osVersion": "iPhone OS 26.x.x"
```

**Cause**: iOS 26 changed internal ABI/APIs that React Native 0.81's **New Architecture** TurboModule manager depends on. The TurboModule manager dereferences a pointer that iOS 26 no longer provides, crashing before any JS code runs. `newArchEnabled: true` is the trigger.

**Fix applied**:
1. `newArchEnabled: false` in `app.config.js` — switches to old bridge architecture which avoids the TurboModule manager entirely
2. `react-native-reanimated: ~3.16.0` — Reanimated 4.x requires new arch; v3.x works on old arch
3. Removed `react-native-worklets` — only needed for Reanimated 4
4. Added `react-native-reanimated/plugin` to `babel.config.js` — required for Reanimated 3

**Reanimated 3 vs 4 API compatibility**: All core APIs (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`, `runOnJS`, `interpolate`, etc.) are identical between v3 and v4. No app code changes needed.

**Note**: If/when React Native 0.82+ releases with iOS 26 support, `newArchEnabled: true` + Reanimated 4 can be restored. At that point, remove `react-native-reanimated/plugin` from `babel.config.js` and restore `react-native-worklets`.

---

### 8. EXPO_ROUTER_APP_ROOT not inlined (bundle error in EAS)

**Error message** (on device or in Metro):
```
process.env.EXPO_ROUTER_APP_ROOT — First argument of require.context should be a string
```

**Cause**: Metro's `collect-dependencies` requires the first argument of `require.context()` to be a static string literal. `babel-preset-expo` normally inlines `process.env.EXPO_ROUTER_APP_ROOT` via the Metro caller chain, but this can fail in the EAS build environment.

**Fix**: A custom Babel plugin in `babel.config.js` (`expoRouterCtxInlinePlugin`) explicitly inlines both `EXPO_ROUTER_APP_ROOT` and `EXPO_ROUTER_IMPORT_MODE` for any `expo-router/_ctx*` file. This is already in place — do not remove it.

---

### 6. Workflows all crash after running `pnpm install`

**Cause**: `pnpm install` without `--filter` reinstalls the entire workspace from scratch, which can temporarily remove `node_modules` contents while it works. If workflows try to start during this window they fail.

**Fix**: After `pnpm install` completes, restart all three workflows:
- API Server
- Component Preview Server  
- Task Manager (Expo)

You can restart them from the Replit interface or by running `wake up` (which triggers an API server restart).

---

### 9. App crashes on launch after adding `useAnimatedStyle` — missing worklets babel plugin

**Symptom**: App built successfully but crashes on launch (splash screen shows briefly then exits). No change to native packages — only added Reanimated hooks to a component.

**Cause**: `useAnimatedStyle` (and other Reanimated hooks that run on the UI thread) require Babel to transform the callback function into a **worklet** at build time. Reanimated 4 with `react-native-worklets` requires `react-native-worklets/plugin` in `babel.config.js`. Without it, the worklet function is bundled as plain JS, which crashes when Reanimated tries to execute it on the UI thread.

**Fix**: Add `react-native-worklets/plugin` to `babel.config.js` plugins:
```js
plugins: [expoRouterCtxInlinePlugin, 'react-native-worklets/plugin'],
```

**Rule**: Any time `useAnimatedStyle`, `useAnimatedScrollHandler`, or any Reanimated hook that creates a worklet is added to a component, `react-native-worklets/plugin` must be present in `babel.config.js`. This is already in place — do not remove it.

---

### 10. Xcode build error — `type 'FileSystemUtilities' has no member 'isReadableFile'`

**Error message** (in Xcode / EAS build):
```
type 'FileSystemUtilities' has no member 'isReadableFile'
```

**Cause**: `expo-video-thumbnails 55.x` is for **Expo SDK 55** and calls `FileSystemUtilities.isReadableFile(appContext, url)` — a static method added to `expo-modules-core 4.x` (SDK 55). On Expo SDK 54 (`expo-modules-core 3.0.x`), that method doesn't exist, so Xcode fails to compile.

**Fix**: Pin `expo-video-thumbnails` to `10.0.8` (the SDK 54-compatible release, despite the non-obvious version number):
```json
"expo-video-thumbnails": "10.0.8"
```
Then update both lockfiles:
```bash
# From workspace root
pnpm install --no-frozen-lockfile
# From artifacts/task-manager
npm install --package-lock-only
```

**Note**: The npm dist-tags show `sdk-50: 7.9.0`, `sdk-51: 8.0.0`, then a jump to `55.0.x` for SDK 55. Versions `10.x` cover SDK 52-54 without a dedicated dist-tag.

---

### 11. My Music tracks show in list but tapping them does nothing (silent play failure)

**Symptom**: After installing a new build, tracks appear in the My Music list (AsyncStorage has them) but tapping does nothing — no sound, no error shown.

**Cause**: Tracks are stored in AsyncStorage with their **full absolute URI**, e.g.:
```
/var/mobile/Containers/Data/Application/OLD-UUID/Documents/music/song.mp3
```
When iOS installs a new build, the app's container gets a new UUID. The file may still exist but the stored path is stale — `Audio.Sound.createAsync` throws an error that is silently swallowed by the `catch` block in `MusicPlayerContext.playTrack`.

**Fix** (applied to `music-mymusic.tsx` load `useEffect`):
On load, normalize every stored URI by extracting just the filename and reconstructing the path from the current `FileSystem.documentDirectory + "music/"`. Also validates each file actually exists on disk and silently drops any that don't, then persists the corrected list back to AsyncStorage.

**Rule**: Never store raw `documentDirectory`-based absolute paths in AsyncStorage. Always reconstruct from the current `documentDirectory` at load time using the filename portion only.

---

### 12. Background audio stops when app is minimised

**Symptom**: Music plays fine in-app, stops the moment you swipe home or lock the screen.

**Cause**: Two separate bugs:

1. `UIBackgroundModes: ["audio"]` was in `app.json` but NOT in `app.config.js`. Because `app.config.js` completely overrides the Expo config (it does not import or spread `app.json`), the key was never written to `Info.plist` in the native build. Without `UIBackgroundModes` in `Info.plist`, iOS suspends audio the instant the app enters the background regardless of what the JS audio session says.

2. `interruptionModeIOS: InterruptionModeIOS.MixWithOthers` was set in `Audio.setAudioModeAsync`. `MixWithOthers` signals to iOS that the audio is a secondary/ambient source — iOS is less likely to maintain the session aggressively in the background. A music player must use `DoNotMix` to claim the audio session exclusively.

**Fix**:
- Add `UIBackgroundModes: ['audio']` to `infoPlist` inside `app.config.js` → `ios`:
```js
infoPlist: {
  ITSAppUsesNonExemptEncryption: false,
  NSFaceIDUsageDescription: '...',
  UIBackgroundModes: ['audio'],   // ← REQUIRED for background audio
},
```
- Change `interruptionModeIOS` to `InterruptionModeIOS.DoNotMix` in `MusicPlayerContext.tsx`.

**Rule**: `app.json` keys are IGNORED when `app.config.js` exists — always put native config in `app.config.js`.

---

## Dependency Version Reference

These are the exact pinned versions required for a successful build with Expo 54 / React Native 0.81 on iOS 26 beta:

| Package | Required Version | Notes |
|---|---|---|
| `react-native` | `0.81.5` | |
| `expo` | `~54.0.27` | |
| `react-native-reanimated` | `~4.1.1` | |
| `react-native-worklets` | `0.5.1` | Required by Reanimated 4; needs `react-native-worklets/plugin` in babel |
| `expo-screen-orientation` | `~9.0.8` | Used to unlock landscape in Mi Corazon Viewer; requires EAS build. **Must be listed in `app.config.js` plugins array** (`'expo-screen-orientation'`) — without the plugin, iOS ignores `unlockAsync()` even if `orientation:'default'` is set. |
| `react-native-keyboard-controller` | **REMOVED** | Crashes on iOS 26 (use-after-free in JSI bindings) |
| `react-native-track-player` | `^4.1.2` | Drives Lock Screen Now Playing widget, Control Center controls, and CarPlay. Replaces `expo-av` for music playback. Background service registered via `TrackPlayer.registerPlaybackService(() => PlaybackService)` in `_layout.tsx`. CarPlay also requires the `com.apple.developer.carplay-audio` entitlement (see CarPlay Setup below). |

`newArchEnabled: true` in `app.config.js`.
`react-native-worklets/plugin` must be in `babel.config.js` plugins whenever any Reanimated worklet hooks are used.

---

## CarPlay Setup (one-time — Apple Developer portal)

`react-native-track-player` with `com.apple.developer.carplay-audio` in `app.config.js` provides the JS/native side. But Apple must also enable the entitlement on the App ID:

1. Go to **developer.apple.com → Certificates, IDs & Profiles → Identifiers**
2. Select `com.hklife.app`
3. Under **Capabilities**, enable **CarPlay** (it will be in the "Paid/Approved" section — tick the checkbox and Save)
4. Apple approves this automatically for audio apps — no review needed
5. Regenerate the provisioning profile in EAS: run `eas credentials` → iOS → select the profile → **sync**
6. Rebuild with EAS

Without step 3–5, the entitlement is in the binary but not in the provisioning profile, causing a code signing error at install time.

---

### 14. Apple Music shows "Install Required" in real native build

**Symptom**: Even in an EAS-built IPA (not Expo Go), the Apple Music screen shows "Install Required". The JS bundle loads fine but `requireNativeModule("AppleMusicKit")` throws because the Swift module was never compiled into the binary.

**Cause**: `apple-musickit` is declared as `"file:./modules/apple-musickit"` in `package.json`. pnpm hoists it to the **workspace root** `node_modules/` during install, not `artifacts/task-manager/node_modules/`. Expo's auto-linker (`expo-modules-autolinking`) generates the Xcode project by scanning `node_modules` relative to the app package — it doesn't find the module at the workspace root, so the Swift code is never compiled in. The Metro `LOCAL_MODULES` fix only solves the JS bundle side; native auto-linking is a separate step.

**Fix (belt and suspenders)**:

1. `expo.autolinking.extraSearchPaths` in `package.json` tells the auto-linker to scan `./modules/` directly:
```json
"expo": {
  "autolinking": {
    "extraSearchPaths": ["./modules"]
  }
}
```

2. `prebuildCommand` in `eas.json` (preview profile) runs `scripts/ensure-local-modules.js` **before** `expo prebuild`, symlinking (or copying) `modules/apple-musickit` into `node_modules/apple-musickit`. This guarantees the standard `node_modules` scan also finds the module:
```json
"prebuildCommand": "node scripts/ensure-local-modules.js && npx expo prebuild --non-interactive"
```

Both mechanisms together make this bulletproof regardless of how pnpm hoisting behaves in the EAS environment.

---

### 13. Apple Music native module (apple-musickit)

A local Expo module at `modules/apple-musickit/` provides direct access to the user's Apple Music library using `MPMediaLibrary` and `MPMusicPlayerController`. It is **EAS-only** — the native Swift code is not available in Expo Go, which shows an "Install Required" state on the Apple Music screen.

Three functions:
- `requestAuthorization()` — prompts the user for Apple Music access (SKCloudServiceController). Requires `NSAppleMusicUsageDescription` in infoPlist (already in app.config.js).
- `getPlaylists()` — returns all user-created playlists from the library as `{id, name, count}[]`.
- `playPlaylist(id)` — plays a playlist via `MPMusicPlayerController.systemMusicPlayer`, handing off to Apple Music's built-in player with full DRM/subscription support.

The module is added as `"apple-musickit": "file:./modules/apple-musickit"` in package.json and auto-linked by Expo during the native build.

**pnpm hoisting problem**: pnpm installs `apple-musickit` at the workspace root `node_modules/`, not inside `artifacts/task-manager/node_modules/`. Metro's `nodeModulesPaths` is intentionally restricted to the project's own `node_modules` (to avoid singleton React issues), so `require("apple-musickit")` would fail and the try/catch in `music-apple.tsx` would silently set `AppleMusicKit = null`, showing "Install Required" even in the real build.

**Fix (already applied)**: A direct path override in `metro.config.js` (`LOCAL_MODULES` map) bypasses node_modules resolution entirely for `apple-musickit` and points Metro straight to `modules/apple-musickit/index.ts`. This works regardless of where pnpm hoists the package.

---

## EAS Project Details

| Item | Value |
|---|---|
| EAS project | `@hk1811/hk-life-app` |
| Project ID | `a4b0c416-348f-4f50-914c-76e1b191ca72` |
| Apple Team ID | `LDPV4NPPKY` |
| Bundle ID | `com.hklife.app` |
| Distribution | Ad-hoc (iOS only) |
| Profile for installs | `preview` |

Build history and IPA downloads: **expo.dev → Projects → hk-life-app → Builds**
