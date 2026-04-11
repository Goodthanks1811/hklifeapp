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

### 3. pnpm frozen lockfile mismatch — also triggered by running `expo prebuild` locally

**Error message**:
```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
pnpm-lock.yaml is not up to date with artifacts/task-manager/package.json
specifiers in the lockfile don't match specifiers in package.json
```

**Cause**: EAS detects the root `pnpm-workspace.yaml` and runs `pnpm install --frozen-lockfile`. If `package.json` was changed but `pnpm-lock.yaml` wasn't updated, they go out of sync. **This is also triggered by running `expo prebuild` locally** — prebuild always prints "Updating package.json ✔" which modifies `package.json`, which then diverges from the lockfile.

**Fix**: After any `package.json` change (including after running `expo prebuild` locally), run from the repo root:
```bash
pnpm install --no-frozen-lockfile
```
Then update the npm lockfile too (EAS uses both):
```bash
cd artifacts/task-manager && npm install --package-lock-only
```

**Rule**: Never run `expo prebuild` locally without immediately syncing both lockfiles afterwards. Or avoid running it locally at all — EAS runs its own prebuild on the build server.

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

### 12b. Background audio stops after playing through the queue (music stops after a while, not immediately)

**Symptom**: Music plays fine in the background for a while, then stops. Happens when the phone is locked. Feels like iOS killed the app but it's actually the queue ending.

**Cause**: `TrackPlayer.reset()` — called inside `playTrack()` whenever a new queue is loaded — silently resets `RepeatMode` back to `Off`. `RepeatMode.Queue` was only set in `ensureSetup()`, which runs once and never again (guarded by `playerSetup = true`). So after the first `reset()`, the queue plays through to the last track, finishes, the audio session closes, and iOS terminates the background process. This matches "played for a while then stopped."

**Fix**: Re-apply `setRepeatMode(Queue)` immediately after every `reset()` call in `playTrack()`:
```js
await _TrackPlayer.reset();
await _TrackPlayer.setRepeatMode(_RepeatMode.Queue); // ← must come after reset()
await _TrackPlayer.add(rnTracks);
```

**Rule**: `reset()` wipes ALL player state including repeat mode. Always re-apply `RepeatMode.Queue` after every `reset()`.

---

### 12c. Background audio stops in under a minute — iOS kills the process after RemoteDuck pauses

**Symptom**: Music plays for less than a minute when phone is locked, then stops completely. After opening the app, Face ID prompt appears (fresh app launch, not a resume). Happens consistently when notifications arrive.

**Cause**: Every notification/sound fires a `RemoteDuck` event with `paused=true`. The old handler paused RNTP and started a 10-second timer to resume. During that 10-second window the audio session went idle (RNTP released it on pause). iOS detected the idle background audio session, removed the background-audio privilege, and killed the process — stopping music and forcing a full app restart, which triggers the biometric lock on next open.

**Fix**: Changed the `RemoteDuck` handler in `service.ts` to only pause for events that truly require it:
- `permanent=true` (phone call answered) → pause
- Apple Music taking control → pause RNTP (source switch)
- Non-permanent interruption (notifications, Siri, etc.) → **do nothing**

With `DoNotMix`, notification sounds are already suppressed by iOS when the audio session is active. By keeping RNTP playing through non-permanent interruptions, the audio session never goes idle and iOS never kills the background process.

Also fixed: `RemoteStop` now re-applies `RepeatMode.Queue` after `reset()` to match the rule in 12b.

**Rule**: Never pause RNTP for non-permanent `RemoteDuck` events. The 10-second resume timer pattern is dangerous — it creates a window where the audio session can go idle and iOS kills the process.

---

### 12c-ii. RemoteDuck permanent interruption end never resumes audio (phone calls)

**Symptom**: Music stops when a phone call starts. After the call ends, music never resumes automatically.

**Cause**: The `RemoteDuck` handler only resumed on `!e.permanent` (non-permanent interruption end). When a phone call ends, RNTP fires `RemoteDuck` with `permanent=true, paused=false`. The `!e.permanent` guard blocked the resume.

**Fix**: Removed the `!e.permanent` guard from the resume branch. Now any interruption end resumes if user didn't deliberately pause:
```ts
} else {
  // Interruption ended (both permanent and non-permanent)
  if (!userPaused && !appleMusicHasControl() && !spotifyHasControl()) {
    await TrackPlayer.play();
  }
}
```

---

### 12e. Background audio stops after ~30 seconds — RNTP deactivates session during track transitions

**Symptom**: Music stops ~30 seconds after locking the phone. `UIBackgroundModes: ['audio']` IS confirmed in Info.plist (verified by extracting and reading the IPA). The app was being killed exactly 30 seconds after the audio session went idle — not because of missing UIBackgroundModes, but because RNTP deactivated the session during normal playback.

**Root cause (confirmed from RNTP 4.1.2 source)**: `RNTrackPlayer.swift`'s `configureAudioSession()` contains:
```swift
if ((item != nil && lastItem == nil) || item == nil) {
    configureAudioSession();
}
```
And in `configureAudioSession()`:
```swift
if (player.currentItem == nil) {
    try? audioSessionController.deactivateSession()  // ← KILLS THE SESSION
    return
}
```
Whenever `currentItem` transitions to `nil` — which happens during track transitions and `RepeatMode.Queue` wrap-around from last track back to first — the audio session is deactivated. iOS then starts the standard 30-second background task expiration timer. The app is killed 30 seconds after the first track transition.

**How to confirm UIBackgroundModes is in the IPA**:
```js
// Extract IPA (ZIP), decompress Info.plist, search for UIBackgroundModes
python3 -c "
import zipfile, plistlib
with zipfile.ZipFile('hklife.ipa') as z:
    plists = [n for n in z.namelist() if n.endswith('.app/Info.plist')]
    plist = plistlib.loads(z.read(plists[0]))
    print('UIBackgroundModes:', plist.get('UIBackgroundModes'))
"
```

**Fix**: Added a 15-second watchdog timer in `service.ts` that checks RNTP's playback state and calls `play()` if the session went idle unexpectedly. This re-activates the audio session well within the 30-second kill window:
```ts
const watchdog = setInterval(async () => {
  if (userPaused || appleMusicHasControl() || spotifyHasControl()) return;
  const state = await TrackPlayer.getPlaybackState();
  const isIdle = [State.Paused, State.Stopped, State.Ready].includes(state?.state);
  if (isIdle) {
    const queue = await TrackPlayer.getQueue();
    if (queue?.length > 0) await TrackPlayer.play();
  }
}, 15000);
```

**Rule**: RNTP 4.1.2's native `configureAudioSession()` deactivates the audio session on any `currentItem == nil` transition. The watchdog is the only reliable defense against this without patching RNTP's native code.

---

### 13. Linker error: `SpotifyiOS.framework` fat file missing arch 'arm64'

**Symptom**: Build fails at "Run fastlane" step with:
```
ld: warning: ignoring file '...SpotifyiOS.framework/SpotifyiOS': fat file missing arch 'arm64', file has 'i386,armv7,x86_64'
Undefined symbols for architecture arm64:
ld: symbol(s) not found for architecture arm64
```

**Root cause**: `react-native-spotify-remote@1.0.0-1` ships a legacy `SpotifyiOS.framework` that only contains `i386,armv7,x86_64` architectures — no arm64. Every iOS device since iPhone 5s is arm64. The linker ignores the framework entirely, then fails because all Spotify symbols are unresolved.

The package also ships `SpotifyiOS.xcframework` (with `ios-arm64_armv7` and `ios-arm64_i386_x86_64-simulator` slices) but the `RNSpotifyRemote.podspec` hardcodes `.framework` not `.xcframework`.

**Why it worked in build `f9dff714` but not `7ca91822`**: Before the lockfile fix, `react-native-spotify-remote@^1.1.4` (non-existent version) failed to install, so Spotify wasn't in `node_modules` and RNSpotifyRemote wasn't linked. After fixing the lockfile to `1.0.0-1`, the broken framework got linked.

**Fix**: Config plugin (`withAppleMusicKit.js` step 0) that patches `RNSpotifyRemote.podspec` before pod install:
- `vendored_frameworks` → `SpotifyiOS.xcframework`
- `preserve_path` → `SpotifyiOS.xcframework`
- `source_files` headers path → xcframework `ios-arm64_armv7` slice

**Rule**: `react-native-spotify-remote@1.0.0-1` cannot be used with its bundled `.framework` on arm64 devices. Always patch to `.xcframework` via config plugin.

---

### 12d. Background audio stops for ALL sources ~30 seconds after phone locks — UIBackgroundModes not taking effect

**Symptom**: Music from both My Music (RNTP) and Apple Music (MPMusicPlayerController) stops ~30 seconds after the phone screen is locked. No notifications involved. App process is killed and a fresh launch (with Face ID prompt) is required.

**Cause**: The 30-second timing is the standard iOS background task expiration window for apps WITHOUT a registered background mode. Both `MPMusicPlayerController.applicationQueuePlayer` and RNTP are in-process players — when the process is suspended, both stop.

The root issue: `UIBackgroundModes: ['audio']` was set via `infoPlist` in `app.config.js`, but this approach can be silently dropped or mis-formatted by the Expo build system in some SDK versions. The key was not making it into Info.plist.

**Fix**: Added a `withInfoPlist` call directly inside `plugins/withAppleMusicKit.js` — the canonical Expo plugin API that is guaranteed to write the key in the correct plist array format:
```js
config = withInfoPlist(config, (cfg) => {
  const plist = cfg.modResults;
  if (!Array.isArray(plist.UIBackgroundModes)) plist.UIBackgroundModes = [];
  if (!plist.UIBackgroundModes.includes('audio')) plist.UIBackgroundModes.push('audio');
  return cfg;
});
```

**Rule**: Always set `UIBackgroundModes` via `withInfoPlist` in a config plugin, NOT via the `infoPlist` key in `app.config.js`. The plugin API guarantees the correct plist format. The `infoPlist` shorthand is unreliable for array-type keys.

**Additional fix (belt-and-suspenders)**: Even `withInfoPlist` can be overwritten by Expo's built-in infoPlist processing if it runs in the wrong order. The definitive fix is a second `withDangerousMod` in `withAppleMusicKit.js` that directly patches the generated `ios/HKLifeApp/Info.plist` XML file on disk — dangerous mods run LAST (after all info-plist mods), so nothing can overwrite it afterwards. This is now in place.

---

### 15. Pod install fails in 3 seconds — `pod install exited with non-zero code: 1`

**Symptom**: EAS build fails at "Install pods" step in ~3 seconds. Prebuild succeeds (10s). Podfile is syntactically valid and prebuild runs cleanly locally.

**Likely cause**: Expo SDK 54 with `newArchEnabled: true` causes the generated Podfile to set `RCT_USE_PREBUILT_RNCORE=1` and `RCT_USE_RN_DEP=1`. These cause CocoaPods to download pre-compiled React Native binaries from Expo's CDN instead of compiling from source. If the CDN is unreachable or the prebuilt binary for this exact RN version is unavailable, pod install fails immediately.

The Podfile lines responsible:
```ruby
ENV['RCT_USE_RN_DEP'] ||= '1' if podfile_properties['ios.buildReactNativeFromSource'] != 'true' && podfile_properties['newArchEnabled'] != 'false'
ENV['RCT_USE_PREBUILT_RNCORE'] ||= '1' if podfile_properties['ios.buildReactNativeFromSource'] != 'true' && podfile_properties['newArchEnabled'] != 'false'
```
The `||=` (assign if nil/falsy) means setting these to `"0"` in the EAS env BEFORE pod install prevents the Podfile from overriding them (Ruby treats `"0"` as truthy).

**Fix**: Add to `eas.json` under the `preview` profile env:
```json
"RCT_USE_PREBUILT_RNCORE": "0",
"RCT_USE_RN_DEP": "0"
```
This forces CocoaPods to compile React Native from source, which is slower but doesn't depend on Expo's CDN.

**Note**: Setting `RCT_USE_PREBUILT_RNCORE=0` / `RCT_USE_RN_DEP=0` did NOT fix this — the actual cause was the `react-native-worklets` bug below (issue #16). See that issue for the real fix. These env vars remain in `eas.json` as a belt-and-suspenders measure.

---

### 16. Pod install fails in ~2 seconds — `react-native-worklets` CWD-relative path bug

**Symptom**: Pod install exits with code 1 in 2–3 seconds. No network involved. Prebuild succeeds. The actual Ruby exception is:
```
[Worklets] Feature flags file not found at ./src/featureFlags/staticFlags.json.
```

**Root cause**: `react-native-worklets@0.5.1` (and likely other 0.5.x versions) has a bug in `scripts/worklets_utils.rb` line 73:
```ruby
static_feature_flags_path = File.path('./src/featureFlags/staticFlags.json')
```
`File.path` just converts the string — it doesn't make it absolute. `./` is relative to the **current working directory** at runtime. When CocoaPods runs `pod install`, the CWD is the `ios/` directory (where the Podfile is). So this resolves to `ios/src/featureFlags/staticFlags.json` which doesn't exist. The `raise` fires, pod install exits immediately with code 1.

The file actually lives at `node_modules/react-native-worklets/src/featureFlags/staticFlags.json`. The fix is to use `__dir__` (directory of `worklets_utils.rb` itself = `scripts/`) to build an absolute path.

**Fix**: Added a patch in `plugins/withAppleMusicKit.js` `withDangerousMod` (runs during expo prebuild, before pod install) that rewrites the bad line:
```ruby
# Bad (CWD-relative — breaks when pod install runs from ios/):
static_feature_flags_path = File.path('./src/featureFlags/staticFlags.json')

# Good (__dir__-relative — resolves correctly from scripts/ to src/):
static_feature_flags_path = File.expand_path('../src/featureFlags/staticFlags.json', __dir__)
```

**Rule**: Any time `react-native-worklets` is upgraded, re-check line 73 of `scripts/worklets_utils.rb` for this pattern. The patch in `withAppleMusicKit.js` is idempotent — it checks for both the bad and already-patched strings before writing.

---

### 17. Pod install fails in 2 seconds — `[!] Specifying multiple post_install hooks is unsupported`

**Symptom**: Pod install exits with code 1 in ~2 seconds. No network involved. The EAS build log (accessible via the GraphQL API's `logFiles` field on the Build type) shows:
```
[!] Invalid `Podfile` file: [!] Specifying multiple `post_install` hooks is unsupported.
 #  from .../ios/Podfile:84
 #  -------------------------------------------
 #  # [HKLifeApp] SpotifyiOS arm64 fix
 >  post_install do |installer|
 #    require 'fileutils'
 #  -------------------------------------------
```

**Root cause**: **CocoaPods 1.16.2** (the version in the EAS `macos-sequoia-15.6-xcode-26.0` VM) made multiple `post_install` hooks a hard error. The EAS VM upgraded CocoaPods between builds. Previously our plugin appended a **second** `post_install` block for the SpotifyiOS binary swap. Now only one `post_install` block is allowed.

Note: this was the actual root cause of ALL "Install pods: 2s" failures, not the worklets path bug (which is also fixed proactively but was not the actual error).

**Fix**: Modified `plugins/withAppleMusicKit.js` Layer 2b to **inject** the SpotifyiOS code INTO the existing `post_install` block generated by Expo, instead of appending a new one. Anchor used: `\n  end\nend\n` (the last occurrence in the Podfile = the `post_install do` closing `end` + the `target` closing `end`).

```ruby
# Correct — single post_install block:
post_install do |installer|
  react_native_post_install(
    installer,
    config[:reactNativePath],
    :mac_catalyst_enabled => false,
    :ccache_enabled => ccache_enabled?(podfile_properties),
  )
  # [HKLifeApp] SpotifyiOS arm64 fix
  require 'fileutils'
  _spotify_base = File.join(__dir__, '..', 'node_modules', ...)
  ...
end
```

**Rule**: **Never add a second `post_install` block** to the Podfile in CocoaPods 1.16+. Always merge code into the existing block. Use `lastIndexOf('\n  end\nend\n')` as the injection anchor to find the post_install block's closing `end`.

**How to get actual pod install error**: When EAS shows "Install pods: 2s" with no visible error, use the EAS GraphQL API to get log file URLs:
```bash
curl https://api.expo.dev/graphql \
  -H "Authorization: Bearer $EXPO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ builds { byId(buildId: \"<BUILD_ID>\") { logFiles } } }"}'
# Then curl each URL and search for the error
```

---

### 18. Xcode archive fails — `SpotifyiOS.framework did not contain an Info.plist`

**Symptom**: Pod install passes, JavaScript bundles successfully, but fastlane/Xcode archive fails (~5 min in) with:
```
Framework .../HKLifeApp.app/Frameworks/SpotifyiOS.framework did not contain an Info.plist
(in target 'HKLifeApp' from project 'HKLifeApp')
```

**Root cause**: The flat `SpotifyiOS.framework` that ships with `react-native-spotify-remote` only contains the binary and headers — it is missing `Info.plist` and `Modules/`. Xcode requires both to embed a framework into an app. The xcframework (`SpotifyiOS.xcframework/ios-arm64_armv7/SpotifyiOS.framework/`) has all four files: `SpotifyiOS` (binary), `Info.plist`, `Headers/`, `Modules/`. The previous fix only swapped the binary, not the other files.

**Fix**: Updated `plugins/withAppleMusicKit.js` to copy the **entire** arm64 xcframework slice into the flat `SpotifyiOS.framework/`:
- **Layer 1** (JS, `withDangerousMod` before pod install): uses `fs.readdirSync` + `fs.cpSync` / `fs.copyFileSync` to copy all entries (`SpotifyiOS`, `Info.plist`, `Headers/`, `Modules/`)
- **Layer 2b** (Ruby, inside `post_install`): uses `Dir.glob + FileUtils.cp_r` to copy all entries

```
xcframework/ios-arm64_armv7/SpotifyiOS.framework/
  ├── SpotifyiOS       (arm64 binary)
  ├── Info.plist       ← WAS MISSING in flat framework
  ├── Headers/
  └── Modules/         ← WAS MISSING in flat framework
```

**Rule**: When updating `react-native-spotify-remote`, verify the flat `SpotifyiOS.framework/` has all four files (`SpotifyiOS`, `Info.plist`, `Headers/`, `Modules/`). If any are missing, the xcframework copy in `withAppleMusicKit.js` will restore them at build time.

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

**Root cause (confirmed from build logs)**: Three previous attempted fixes all failed:

1. `searchPaths: ["./modules"]` in `package.json` — expo-modules-autolinking silently fails to pick it up in the EAS pnpm workspace environment. `apple-musickit` **never appears in the pod install list** in any build that relies on autolinking.

2. `eas-build-post-install.sh` — EAS runs this **after** `pod install` (the `POST_INSTALL_HOOK` phase follows `INSTALL_PODS` in the build log). The symlink is created too late; autolinking has already finished without the module.

3. `eas-build-post-install` npm script — same timing issue. EAS detects it and also runs it after pods.

**Working fix — Expo config plugin + CocoaPods podspec:**

The fix bypasses autolinking entirely:

**Step 1**: `modules/apple-musickit/apple-musickit.podspec` — a real CocoaPods spec that declares the Swift source files and dependencies:
```ruby
Pod::Spec.new do |s|
  s.name           = 'apple-musickit'
  s.source_files   = 'ios/**/*.swift'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MediaPlayer', 'StoreKit'
end
```

**Step 2**: `plugins/withAppleMusicKit.js` — an Expo config plugin using `withDangerousMod` that directly injects the pod into the generated Podfile during `expo prebuild`:
```js
podfile.replace(
  /(\s*use_expo_modules!\s*\n)/,
  `$1  pod 'apple-musickit', :path => '../modules/apple-musickit'\n`
);
```

**Step 3**: `app.config.js` — registers the plugin:
```js
plugins: [..., './plugins/withAppleMusicKit']
```

**Verified working**: Build `d7290a63` shows `Installing apple-musickit (1.0.0)` in the `INSTALL_PODS` phase — the Swift module is compiled and `AppleMusicKitModule` is registered by `ExpoModulesCore` at runtime.

**Important — do NOT use `prebuildCommand` for shell scripts.** EAS prepends `pnpm expo` to whatever value you set, so `prebuildCommand: "node scripts/foo.js && npx expo prebuild"` becomes `pnpm expo node scripts/foo.js && npx expo prebuild` — `pnpm expo node` is not a valid expo command and the build fails. `prebuildCommand` is only for passing additional flags to `expo prebuild`. Use config plugins for any Podfile/native project modifications.

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

---

### 15. Apple Music "Install Required" — ExpoModulesProvider never registers the module (root cause + final fix)

**Root cause confirmed (builds d7290a63 → 1c3069cf)**:

The pod WAS being compiled (`Installing apple-musickit (1.0.0)` in INSTALL_PODS), but `ExpoModulesProvider.swift` — the generated file that lists every native module — never included `AppleMusicKitModule`. Autolinking computes the provider's list during `expo prebuild` (PREBUILD phase), which runs **before** pnpm install. Any fix that creates a symlink during/after pnpm install (postinstall hook, eas-build-post-install) arrives too late for autolinking.

**Why the old Swift ExpoModulesCore approach was never going to work without autolinking finding the module**: `requireNativeModule("AppleMusicKit")` looks up the module in ExpoModulesProvider's class list. If the class isn't there, it throws — which `music-apple.tsx` catches, sets `AppleMusicKit = null`, and shows "Install Required".

**Final fix (build d7a39e73, confirmed working in logs)**:

Rewrote the module as a **plain Objective-C bridge module** (`RCT_EXPORT_MODULE`) instead of an ExpoModulesCore Swift module. ObjC bridge modules self-register via the Objective-C runtime at app startup — no ExpoModulesProvider entry needed.

Files changed:
- `modules/apple-musickit/ios/AppleMusicKit.h` — ObjC header, declares `RCTBridgeModule` conformance
- `modules/apple-musickit/ios/AppleMusicKit.m` — implementation with `RCT_EXPORT_MODULE(AppleMusicKit)` and `RCT_EXPORT_METHOD` for `requestAuthorization`, `getPlaylists`, `playPlaylist`
- `modules/apple-musickit/apple-musickit.podspec` — `source_files = 'ios/**/*.{h,m}'`; depends on `React-Core` (not ExpoModulesCore)
- `modules/apple-musickit/index.ts` — uses `NativeModules.AppleMusicKit` instead of `requireNativeModule`; throws if null (so the `try/catch` in `music-apple.tsx` still shows "Install Required" in Expo Go)

**Build log confirms** (d7a39e73):
- `INSTALL_DEPENDENCIES`: `postinstall: [ensure-local-modules] Symlinked apple-musickit → node_modules/`
- `INSTALL_PODS`: `Installing apple-musickit (1.0.0)`
- `ON_BUILD_SUCCESS_HOOK`: archive succeeded

`NativeModules.AppleMusicKit` is non-null in this build because:
1. ObjC `RCT_EXPORT_MODULE` registers the class in the ObjC runtime on binary load
2. RN 0.81 (even with `newArchEnabled: true`) exposes bridge modules via `NativeModules` through the interop compatibility layer

**Important**: `ios/AppleMusicKitModule.swift` has been **deleted** from the repo. Even though the podspec only compiled `*.{h,m}`, Expo's autolinking scanner still finds any Swift file that conforms to the `Module` protocol and adds it to the generated `ExpoModulesProvider.swift`. The generated file then references `AppleMusicKitModule.self` — a class that never compiles (because the podspec excludes it) — causing Xcode error: `cannot find 'AppleMusicKitModule' in scope`. Fix: delete the Swift file entirely so autolinking never sees it.

---

### 16. Swift compile error — `'volume' is unavailable in iOS: Use MPVolumeView`

**Error message** (from Xcode / EAS Run fastlane step):
```
'volume' is unavailable in iOS: Use MPVolumeView for volume control.
```

**Cause**: `MPMusicPlayerController.applicationQueuePlayer.volume = Float(volume)` in `AppleMusicKitModule.swift` (written by `withAppleMusicKit.js`). Apple removed the `volume` setter from `MPMusicPlayerController` in the iOS SDK — it no longer compiles.

**Fix** (in `plugins/withAppleMusicKit.js` SWIFT_CONTENT, `setVolume` function): Replace the direct `.volume` assignment with an `MPVolumeView` slider approach:
```swift
let vv = MPVolumeView(frame: CGRect(x: -2000, y: -2000, width: 1, height: 1))
if let scene = UIApplication.shared.connectedScenes
    .compactMap({ $0 as? UIWindowScene }).first,
   let window = scene.windows.first {
  window.addSubview(vv)
  if let slider = vv.subviews.first(where: { $0 is UISlider }) as? UISlider {
    slider.setValue(Float(volume), animated: false)
    slider.sendActions(for: .valueChanged)
  }
  vv.removeFromSuperview()
}
```
Creates an offscreen `MPVolumeView` (-2000, -2000), attaches it to the key window momentarily, finds the system volume `UISlider` subview, sets its value and fires `.valueChanged` to commit the change, then removes the view. This is the Apple-recommended pattern for programmatic volume control.

---

### 17. "Something went wrong" (ErrorBoundary) when music starts playing + GlobalMusicPlayer never visible

**Symptom**: Tapping any song (My Music or Apple Music) causes the app to switch to a red "Something Went Wrong" error screen. The GlobalMusicPlayer mini bar never appears.

**Cause**: React Rules of Hooks violation in `GlobalMusicPlayer.tsx`. The component had an early `return null` at line 149 (`if (!source) return null`) and three `useRef` hooks (`slideAnim`, `dragY`, `dismissPR`) placed AFTER that early return. On the first render, `source` is null so the early return fires and those hooks do not run. When music starts, `source` becomes non-null, React renders the full component, encounters more hooks than the previous render had, and throws: "Rendered more hooks than during the previous render." The ErrorBoundary catches this and shows the error screen.

**Fix** (applied to `components/GlobalMusicPlayer.tsx`): Move ALL hook calls (`useState`, `useRef`, `useCallback`) to BEFORE the `if (!source) return null` line. The early return is still valid as a rendering gate — it just cannot come before any hook call.

**Rule**: In any component with a conditional early `return null`, every `use*` hook call must be placed before that return statement, no exceptions.

---

### 18. My Music — nothing plays when tapping a song (silent failure)

**Symptom**: Tapping a track in My Music triggers the haptic but no audio starts. The GlobalMusicPlayer mini bar doesn't appear.

**Cause**: Two stacked bugs:

1. `modules/apple-musickit/index.ts` exported only 5 methods (`requestAuthorization`, `getPlaylists`, `getSongsInPlaylist`, `playPlaylist`, `playSongInPlaylist`) and omitted the control methods (`pause`, `resumePlay`, `getCurrentTime`, `getDuration`, `seekTo`, `setVolume`, `skipToNext`, `skipToPrevious`). Code that called `require("apple-musickit").pause()` got `undefined()` — a synchronous throw.

2. `MusicPlayerContext.tsx` called `MusicSourceBus.notifyMyMusicPlaying()` OUTSIDE the `try/catch` block. `notifyMyMusicPlaying()` calls the registered `_pauseAppleMusic` callback, which did `AppleMusicKit.pause().catch(...)` — but since `pause` was `undefined`, it threw before `.catch()` was reached. This unguarded throw propagated out of `playTrack`, rejecting its promise, and the entire playback call silently aborted before RNTP was ever touched.

**Fix**:
- Added all missing method exports to `modules/apple-musickit/index.ts`.
- Wrapped `MusicSourceBus.notifyMyMusicPlaying()` in `try { } catch {}` in `MusicPlayerContext.tsx` so cross-source mute never aborts the playback call.

**Rule**: Always export every method from `apple-musickit/index.ts` that any context or screen calls. Any MusicSourceBus notification call should be guarded with try/catch since it invokes external callbacks that may fail.

---

### 19. App force-quits while music is playing (My Music & Apple Music) on iOS 26

**Symptom**: Music stops mid-song and the app requires Face ID to reopen (cold-launch kill, not a crash). Happens with both My Music (RNTP) and Apple Music (applicationQueuePlayer). Happens even with RepeatMode.Queue set and the 5-second JS watchdog in service.ts running.

**Root cause**: RNTP's native `configureAudioSession()` calls `deactivateSession()` whenever `currentItem == nil`. This window occurs during every track transition and RepeatMode.Queue wrap-around (last→first track). In previous iOS versions, the app was given ~30 seconds of grace after session deactivation to reactivate before being killed. On **iOS 26 Apple significantly tightened this grace period**: the JS thread can be suspended within seconds of the session dropping, meaning the JS watchdog (service.ts `setInterval` at 5 s) and even the `PlaybackActiveTrackChanged` event handler may never fire.

**Fix** (`ios/AppleMusicKitModule.swift`): Added a **native Swift Timer (`Timer.scheduledTimer`, 2 s interval)** that calls `AVAudioSession.sharedInstance().setActive(true)` at the native level, completely independently of the JS thread. This timer runs on the main run loop and is unaffected by JS thread suspension.

New private members:
```swift
private var nativeWatchdog: Timer?
```

New private methods:
- `startNativeWatchdog()` — invalidates any existing timer, immediately calls `reactivateSession()`, then schedules a 2-second repeating `Timer`.
- `stopNativeWatchdog()` — invalidates and nils the timer.
- `reactivateSession()` — calls `AVAudioSession.sharedInstance().setActive(true)` only (no category change, so it doesn't stomp MixWithOthers set by the Spotify keepalive).

New `AsyncFunction` exports: `startNativeWatchdog`, `stopNativeWatchdog`.

**Wiring** (`utils/MusicSourceBus.ts`):
- Added `_startWatchdog` / `_stopWatchdog` callbacks and `registerStartWatchdog` / `registerStopWatchdog`.
- `notifyMyMusicPlaying()` → `_stopKeepalive?.()` then `_startWatchdog?.()`.
- `notifyAppleMusicPlaying()` → `_stopKeepalive?.()` then `_startWatchdog?.()`.
- `notifySpotifyPlaying()` → `_stopWatchdog?.()` first (prevent category conflict), then `_startKeepalive?.()`.

**Wiring** (`context/SpotifyPlayerContext.tsx`): Extended the existing keepalive `useEffect` to also register the watchdog callbacks pointing at `AppleMusicKit.startNativeWatchdog()` / `stopNativeWatchdog()`.

**Result**: Whenever My Music or Apple Music starts playing, a native Swift timer fires every 2 seconds calling `setActive(true)`. Even if RNTP deactivates the session during a track transition and iOS immediately suspends the JS thread, the native timer fires within 2 seconds and repairs the session — well within any grace period on any iOS version.

**Rule**: Do not rely solely on JS watchdogs for background audio session management on iOS 26+. Always pair them with a native-level timer in the Swift module that runs independently of the JS thread.

---

### 20. CRITICAL: Background keepalive, isPlayingNative, and native watchdog all silently no-ops

**Symptom**: App continues to be killed during background audio (both My Music and Spotify), foreground state recovery after backgrounding doesn't work, and all new watchdog calls have no effect.

**Root cause**: `modules/apple-musickit/index.ts` was only updated with a subset of the functions added to `AppleMusicKitModule.swift`. Every time a new `AsyncFunction` is added to the native Swift module, it MUST also be exported from `index.ts`. Any context that imports via `require("apple-musickit")` (typed as `any`) and uses optional chaining (`?.`) will silently no-op if the export is missing — no error, no warning, nothing.

The following functions were added to the Swift module but **not** exported from `index.ts`:
- `startSilentKeepAlive` — Spotify background keepalive (plays silent PCM buffer with MixWithOthers)
- `stopSilentKeepAlive` — stops the above
- `isPlayingNative` — queries `applicationQueuePlayer.playbackState` (used for Apple Music foreground sync)
- `startNativeWatchdog` — 2-second native Swift Timer that calls `setActive(true)` independently of JS
- `stopNativeWatchdog` — stops the above

**Fix**: Added all five missing exports to `modules/apple-musickit/index.ts`.

**Rule**: Every `AsyncFunction` added to `AppleMusicKitModule.swift` MUST have a corresponding export in `modules/apple-musickit/index.ts`. After adding any native function, ALWAYS verify index.ts contains it. The `?.` optional chaining used in every call site (`AppleMusicKit?.someNewFn?.()`) will silently no-op if the export is missing — this is extremely easy to miss.

---

### 21. My Music cuts out ~53 seconds after phone is locked

**Symptom**: My Music (RNTP) plays fine in foreground but dies approximately 53 seconds after the screen is locked.

**Root cause**: `startNativeWatchdog()` was only called from `SpotifyPlayerContext.tsx` — it was never called for My Music (RNTP). Without the native Swift 2-second timer calling `setActive(true)`, when RNTP deactivates the audio session during a track transition (`configureAudioSession()` → `deactivateSession()` when `currentItem == nil`), iOS starts a 30-second kill clock. The JS `setInterval` watchdog in `service.ts` is unreliable when the phone is locked (JS thread suspended). No native watchdog → session deactivation → ~30 seconds later iOS kills the process. Total: ~23s of music before transition + 30s kill window = ~53s.

**Fix**: Added `_AppleMusicKit?.startNativeWatchdog?.().catch?.(() => {})` at the end of `playTrack` in `context/MusicPlayerContext.tsx`, after `_TrackPlayer.play()`. The native watchdog fires independently of the JS thread on the Swift main run loop, which iOS keeps pumping during the 30-second grace window after session deactivation.

---

### 22. Apple Music stuck after first song tap — no subsequent tap works

**Symptom**: Tapping a song in Apple Music silently does nothing (no audio, no error), and all subsequent song taps are also blocked.

**Root cause**: `AppleMusicKit.playSongInPlaylist()` awaits a Swift `prepareToPlay { error in ... }` callback that, in some states (DRM check pending, player in a bad state), never fires. The promise never settles, the `finally` block never runs, `loadingKey` stays set, and all subsequent taps hit `if (!AppleMusicKit || loadingKey) return` and silently bail.

**Fix**: Wrapped `AppleMusicKit.playSongInPlaylist()` in `Promise.race()` with an 8-second timeout in `handlePlaySong` (`app/music-apple.tsx`). If the native call doesn't resolve within 8 seconds, the race rejects with a user-visible error message, the `finally` block runs, `loadingKey` is cleared, and the user can tap again.

---

### 23. Apple Music playlist filter (long press) lost after GitHub merge

**Symptom**: Long-pressing the EQ icon on the Apple Music screen header had no effect. The `music_apple_filter_names` AsyncStorage key existed but there was no way to set or clear it from the UI.

**Root cause**: The accordion UI rewrite removed the `onLongPress` handler from the header's EQ bar `Pressable`.

**Fix**: Added `openFilterDialog` function to `MusicAppleScreen` in `app/music-apple.tsx`. It reads the current filter list from AsyncStorage and shows an `Alert` with "Add Filter" (uses `Alert.prompt` for text input on iOS) and "Clear All Filters" options. Added `onLongPress={openFilterDialog} delayLongPress={400}` back to the header EQ bar `Pressable`.

---

### 24. Spotify 403 error shows redundant Alert AND "Access Restricted" UI

**Symptom**: When a Spotify playlist returns a 403, the user sees a raw JSON `Alert` popup AND then the in-screen "Access Restricted" UI with a Reconnect button, requiring two dismissals.

**Root cause**: `openPlaylist` catch block called `Alert.alert("Spotify Track Error", msg)` for ALL errors including 403s. But 403s also set `trackError` state which renders the "Access Restricted" UI with a Reconnect button — a much cleaner, more actionable UI. The Alert was redundant and showed raw JSON (`{"error":{"status":403,"message":"Forbidden"}}`).

**Fix**: Added `if (!msg.includes("403"))` guard before `Alert.alert()` in `openPlaylist` catch block (`app/music-spotify.tsx`). 403 errors now go directly to the "Access Restricted" UI. Non-403 errors (network failures, etc.) still show an Alert since they don't have a dedicated in-screen UI.
