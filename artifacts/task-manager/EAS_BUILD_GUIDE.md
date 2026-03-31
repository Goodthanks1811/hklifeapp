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

## Dependency Version Reference

These are the exact pinned versions required for a successful build with Expo 54 / React Native 0.81:

| Package | Required Version | Notes |
|---|---|---|
| `react-native` | `0.81.5` | |
| `expo` | `~54.0.27` | |
| `react-native-reanimated` | `~4.1.1` | |
| `react-native-worklets` | `0.5.1` | Required by Reanimated 4 |
| `react-native-keyboard-controller` | **REMOVED** | Crashes on iOS 26 (use-after-free in JSI bindings) |

`newArchEnabled: true` is required in `app.config.js` for Reanimated 4.x.

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
