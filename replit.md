# Workspace

## GitHub Push — How It Works

**Never use `git push` from the CLI** — it has no credentials and will hang/fail.
**Never ask the user to push manually** — use the GitHub connector API directly.

To push any file to `github.com/Goodthanks1811/hklifeapp`, use this pattern in `code_execution`:

```javascript
const { ReplitConnectors } = await import("@replit/connectors-sdk");
const connectors = new ReplitConnectors();
const fs = await import("fs");

const content = fs.readFileSync("/home/runner/workspace/PATH_TO_FILE", "utf8");
const encoded = Buffer.from(content).toString("base64");

// Get SHA if file already exists (required for updates)
const checkRes = await connectors.proxy("github", "/repos/Goodthanks1811/hklifeapp/contents/PATH_TO_FILE", { method: "GET" });
let sha;
if (checkRes.status === 200) { sha = (await checkRes.json()).sha; }

const body = { message: "COMMIT MESSAGE", content: encoded };
if (sha) body.sha = sha;

const res = await connectors.proxy("github", "/repos/Goodthanks1811/hklifeapp/contents/PATH_TO_FILE", {
  method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" }
});
console.log("Status:", res.status);
```

- Connection ID: `conn_github_01KNAS2Y79W6RCQGK91RFDA87M`
- Repo: `Goodthanks1811/hklifeapp`
- Permissions: `repo` (full read/write)

## GitHub Push + EAS Build — IMPORTANT RULES

**Do NOT push to GitHub after every individual fix.**
Only push to GitHub when the user explicitly asks to push, or when they confirm they are ready to build.

**NEVER trigger an EAS build automatically.**
Always stop after fixes are done and ask the user: "Ready to build?" — wait for their confirmation before pushing to GitHub or running `eas build`.

---

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies. The main deliverable is a React Native / Expo mobile app (`artifacts/task-manager`) backed by an Express API server (`artifacts/api-server`).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   ├── task-manager/       # Expo / React Native app
│   └── mockup-sandbox/     # Vite component preview server
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json      # composite: true, bundler resolution, es2022
├── tsconfig.json           # Root project references
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from the root:

```bash
pnpm run typecheck   # tsc --build --emitDeclarationOnly
pnpm run build       # typecheck then recursive build
```

Running `tsc` inside a single package fails if its dependencies haven't been built yet.

---

## Task Manager App (`artifacts/task-manager`)

Expo / React Native mobile app targeting **iPhone + iPad Pro 12.9"**.

- **Main app theme**: Bold red (`#E03131`) + black
- **IR Quick Add theme**: Navy (`#0C1846`) / Gold (`#FE9A01`)

### Colour Tokens (DO NOT deviate)

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#E03131` | Accent, play button, highlights |
| `pageBG` | `#0b0b0c` | Every screen background |
| `cardBG` | `#0f0f0f` | Cards, rows, list items |
| `border` | `#2A2A2A` | Separators, outlines |
| `text` | `#fff` | Primary text |
| `subtext` | `#888` | Secondary / muted text |

**NEVER use `#1a1a1a`** anywhere in settings or any new screen — use `#0f0f0f` for card/row BG.

### Screens

| File | Purpose |
|------|---------|
| `app/(tabs)/index.tsx` | Task Board — Notion tasks grouped by status |
| `app/settings.tsx` | Settings — API keys, playlist ordering (Spotify/Apple), section headers |
| `app/ir-quick-add.tsx` | IR Quick Add — navy/gold theme |
| `app/life/[slug].tsx` | Life Admin task list — drag-to-reorder, swipe-to-delete |
| `app/music.tsx` | Music Player — player UI, track info, controls, queue |
| `app/music-mymusic.tsx` | My Music — local file library with drag-to-reorder |
| `app/music-apple.tsx` | Apple Music — Apple Music library with drag-to-reorder |
| `app/mi-corazon.tsx` | Mi Corazon — photo/video gallery with full-screen pager viewer |
| `app/shazam.tsx` | Shazam — music recognition screen |
| `app/nrl.tsx` | NRL — rugby league schedule |
| `app/calendar.tsx` | Calendar — event calendar |
| `app/psychology.tsx` | Psychology/Philosophy Daily |
| `app/ui-kit/` | UI Kit showcase: Buttons, Sliders, Drag & Reorder, Loaders, Modals |

### Key Components & Context

| File | Purpose |
|------|---------|
| `components/Drawer.tsx` | Hamburger slide-in drawer |
| `context/NotionContext.tsx` | API key + tasks via AsyncStorage |
| `context/DrawerContext.tsx` | Drawer open/close state |
| `context/MusicPlayerContext.tsx` | Global music player state — current track, queue, play/pause/skip, background audio |
| `constants/colors.ts` | Shared colour tokens |

### Drawer Structure

NAVIGATION → Task Board / Life Admin / Mi Corazon / NRL / Calendar / Psychology / Shazam  
Music → Music Player / My Music / Apple Music  
Scripts → IR Quick Add  
─── divider ───  
Settings (gear icon, pinned to bottom)

### Critical Architecture Notes

**Swipe-to-delete (`app/life/[slug].tsx` — `TaskRow`)**: Uses `Swipeable` from `react-native-gesture-handler` (NOT `PanResponder`). JavaScript PanResponder cannot compete with the native iOS scroll gesture recognizer — any diagonal swipe gets consumed by the ScrollView before JS sees it. `Swipeable` from RNGH operates at the native layer and wins horizontal gestures reliably. `GestureHandlerRootView` is at the root layout (`app/_layout.tsx`).

**Keyboard handling**: NEVER use `KeyboardAvoidingView`. Always use `Keyboard.addListener` + `Animated.Value`.

**Animated.parallel**: NEVER mix `useNativeDriver: true` and `false` in the same parallel call.

**Music screens**: ALL use plain `Animated` (NOT Reanimated). `Easing.sin` for curves. iPad breakpoint: `Dimensions.get("window").width >= 768`.

**expo-router crash rule**: ALL route files in `app/` are eagerly evaluated at Metro bundle time — any module-level error (bad import, missing export, etc.) crashes the entire app immediately. Always guard module-level code carefully.

**expo-file-system import**: Always import from `"expo-file-system/legacy"` (SDK 54 breaking change).

**File URI storage rule (`toRel`/`toAbs`) — applies to EVERY screen that stores file paths**: NEVER write a raw `documentDirectory`-based absolute path into AsyncStorage. iOS changes the app container UUID on fresh install, making stored absolute paths stale. Any `FileSystem` or audio API call with a stale path fails silently. Always store the relative portion only (e.g. `"music/song.mp3"`, `"mi_corazon_media/photo.jpg"`) and reconstruct the absolute path at runtime:
```ts
function toRel(uri: string): string {
  const idx = uri.indexOf("your_dir/");
  return idx !== -1 ? uri.slice(idx) : uri;
}
function toAbs(uri: string): string {
  if (!uri || uri.startsWith("file://") || uri.startsWith("http")) return uri;
  return (FileSystem.documentDirectory ?? "") + uri;
}
```
Use `toRel` before saving to AsyncStorage. Use `toAbs` before passing to `FileSystem`, `Audio.Sound.createAsync`, `Image source`, or any other API that needs a real path. Mi Corazon and My Music both implement this pattern — copy it exactly for any new screen.

---

## IR Quick Add — Key Details

- **DB ID**: `2c9b7eba35238084a6decf83993961e4`
- **Logo URL**: `https://i.postimg.cc/rwCNn1YJ/4375900A-530F-472F-8D00-3C573594C990.png`
- **Epics**: Admin, Testing, Release, Review, Project, Tool, Reporting, Knowledge (each has a colour)
- **Priority emojis**: 🔥 🚩 📈 🪛 👀 🧠 📌

### Loader Animation Pattern (`runLoader(apiPromise)`)

Fire overlay + spinner immediately on tap; API call runs in parallel; enforce minimum spin.

```
T_FADE_IN    = 200ms   overlay fade in
T_SPINNER_IN = 250ms   ring appears
T_MIN_SPIN   = 900ms   minimum spin time before transitioning
T_POP        = 380ms   circle pop (easeOutBack)
T_TICK       = 350ms   tick draw
T_HOLD       = 700ms   hold on success
T_FADE_OUT   = 400ms   fade out
```

---

## Database / Notion IDs

| Purpose | DB ID |
|---------|-------|
| Life / HK Quick Add | `2c8b7eba3523802abbe2e934df42a4e2` |
| IR Quick Add | `2c9b7eba35238084a6decf83993961e4` |
| Mood Log | `2dfb7eba3523805bb4b1ffbe52682e4c` |
| Win Of The Day | `2dfb7eba352380c08db5ec15aa296e3e` |

---

## Music Player — Complete Spec

### Background Audio

`app.json` has `staysActiveInBackground: true` + `UIBackgroundModes: ["audio"]`.  
**Only works in EAS native build, NOT Expo Go.**  
`MusicPlayerContext` (`context/MusicPlayerContext.tsx`) manages global play state — current track, queue, play/pause/skip — shared across all music screens.

### Music Controls (Standardised — DO NOT change these values)

All three control buttons use identical sizing:

| Property | Value |
|----------|-------|
| Hit area | `62×62` `borderRadius: 31` |
| Icon library | `Ionicons` (solid variants) |
| Icon size | `30px` |
| Play button | Red circle (`backgroundColor: "#E03131"`) |
| Skip button colour | `#fff` (pure white) |
| Gap between buttons | `16px` |

Applied to both `music.tsx` and `music-mymusic.tsx`.

### My Music — Storage & Loading

- AsyncStorage key: `mymusic_tracks_v2`
- Files stored at: `documentDirectory + "music/"` (using `expo-file-system/legacy`)
- Track list loaded with `useEffect` — **NOT** `useFocusEffect` (causes double-load bugs)
- `saveTracks` must be `async/await` — never fire-and-forget
- **Always use the `toRel`/`toAbs` pattern for file URIs — identical to Mi Corazon.** Store relative paths (`music/filename.mp3`) in AsyncStorage; convert to absolute only for file ops and playback. iOS changes the container UUID on fresh install — stored absolute paths go stale and `createAsync` fails silently. `toRel` converts absolute→relative for storage; `toAbs` converts relative→absolute for `FileSystem` calls and `playTrack`. The load `useEffect` also validates file existence and drops missing tracks.

### Drag-to-Reorder Pattern (Life Admin + My Music + Apple Music)

All three drag lists use an identical PanResponder-based drag pattern. **Do not deviate.**

```
posAnims     — Animated.Value[] per item: translateY for non-dragging items
addedAnims   — Animated.Value[] per item: supplemental offset for hover slot animation
panY         — Animated.Value: live translateY of the dragging row
dimAnim      — Animated.Value: 0→1 on drag start, used for overlay opacity
ZERO_ANIM    — { current: Animated.Value(0) }: passed to dragging row so posAnim is ignored

isDraggingRef.current — set true on drag start; onMoveShouldSetPanResponderCapture returns this
                        (prevents scroll stealing mid-drag)

relY = moveY - containerTopRef + (scrollOffset - startScroll)
     — absolute Y of finger relative to list top, accounting for scroll delta

Slot calculation: floor((relY - SLOT_H/2) / SLOT_H) clamped 0..(n-1)
```

**Slot heights:**
| List | SLOT_H | Row height | Gap |
|------|--------|-----------|-----|
| Life Admin | `60` | `52px` | `8px` |
| My Music | `60` | `52px` | `8px` |
| Apple Music | `74` | `66px` | `8px` |

**Animation spec:**
- Duration: `110ms`, easing: `Easing.out(Easing.quad)`
- Heavy haptic on drag start
- Light haptic on hover slot change
- Overlay dims with `dimAnim` 0→1 on drag start; tap-to-cancel overlay when `isDragging`
- Order persisted to AsyncStorage on drop

**Container setup:**
- Absolute-positioned container (`position: "absolute"`) so rows can overlap during drag
- `containerTopRef` captured in `onLayout` of the list container
- `scrollOffset` tracked via `onScroll` on parent ScrollView

---

## Mi Corazon — Photo/Video Gallery

### Screen: `app/mi-corazon.tsx`

- Grid view → tap item → opens full-screen `Modal` Viewer
- Viewer is a paginated horizontal `FlatList` (`pagingEnabled`) — swipe left/right to browse
- Dismiss gesture: drag down `> 80px` → animated dismiss (spring back or close)
- Status bar hidden inside Viewer (`<StatusBar hidden />`)

### Landscape Orientation (added 2026-04-06)

Package: `expo-screen-orientation@~9.0.8` (SDK 54 compatible — NOT v55)

**Viewer behaviour:**
```tsx
// On open:
ScreenOrientation.unlockAsync()   // allow free rotation

// On close (cleanup):
ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
// ↑ restores portrait-only for the rest of the app

// After rotation — re-snap pager to current item:
useEffect(() => {
  setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: false }), 80);
}, [width, height]);   // useWindowDimensions() is reactive — layout auto-updates
```

`app.json` already has `"orientation": "default"` which whitelists all four orientations in iOS Info.plist.  
**Requires a new EAS build — does not work in Expo Go (native module).**

---

## Settings — Playlist Ordering

`app/settings.tsx` has chevron `▲`/`▼` arrow buttons on each Spotify and Apple Music playlist row.  
Helper functions: `moveSpotifyUp`, `moveSpotifyDown`, `moveAppleUp`, `moveAppleDown`  
Style: `mStyles.arrowBtn` pattern — boundary rows have buttons dimmed (opacity 0.3)  
Haptic feedback on each tap; saves immediately to AsyncStorage.

---

## Lessons Learned & Established Patterns

### 1. Keyboard Handling (DO NOT use KeyboardAvoidingView)

KeyboardAvoidingView causes jank and conflicts with absolute-positioned footers. Always use:

```tsx
// In component
const keyboardOffset = useRef(new Animated.Value(0)).current;

useEffect(() => {
  const onShow = (e: KeyboardEvent) => {
    Animated.timing(keyboardOffset, {
      toValue: e.endCoordinates.height,
      duration: e.duration || 250,
      useNativeDriver: false,
    }).start();
  };
  const onHide = () => {
    Animated.timing(keyboardOffset, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };
  const s1 = Keyboard.addListener("keyboardWillShow", onShow);
  const s2 = Keyboard.addListener("keyboardWillHide", onHide);
  const s3 = Keyboard.addListener("keyboardDidShow", onShow);   // Android fallback
  const s4 = Keyboard.addListener("keyboardDidHide", onHide);
  return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
}, []);

// Footer: position absolute, drive bottom from keyboardOffset
// ScrollView: drive paddingBottom from footerHeight + keyboardOffset
```

`keyboardAppearance="dark"` on TextInput only takes effect in a **native EAS build**, not Expo Go.

### 2. Absolute Footer + Dynamic Height

```tsx
const [footerH, setFooterH] = useState(0);

// On the footer View:
onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}

// On the ScrollView:
contentContainerStyle={{ paddingBottom: footerH + 8 }}

// Footer position:
style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
```

### 3. iPad Responsiveness

```tsx
const { width } = useWindowDimensions();
const isTablet = width >= 768;

// Wrap content in a centred column:
<View style={{ alignItems: "center" }}>
  <View style={{ width: "100%", maxWidth: isTablet ? 720 : undefined }}>
    {/* content */}
  </View>
</View>
```

Apply `isTablet` to both the scroll body AND the absolute footer.

### 4. Safe Area Insets

```tsx
import { useSafeAreaInsets } from "react-native-safe-area-context";
const insets = useSafeAreaInsets();

// Web override (Replit preview iframe adds false insets):
const topPad = Platform.OS === "web" ? 67 : insets.top;
const botPad = Platform.OS === "web" ? 34 : insets.bottom;
```

### 5. Floating Hamburger (no custom header)

Use this pattern when you want the iOS status bar (time, signal, battery) to show through:

```tsx
// No custom header bar — floating hamburger instead:
<Pressable
  onPress={openDrawer}
  style={{
    position: "absolute",
    top: topPad + 10,
    left: 16,
    zIndex: 10,
    padding: 8,
  }}
>
  <Feather name="menu" size={24} color={IR.text} />
</Pressable>
```

### 6. API Fetch with Safe JSON Parse + Retry (Replit cold-start)

Replit can serve an HTML "waking up" page before the API server is ready. Always use this pattern for schema/data fetches:

```tsx
useEffect(() => {
  if (!apiKey) return;
  let cancelled = false;

  const tryFetch = async (attemptsLeft: number) => {
    try {
      const r = await fetch(`${BASE_URL}/api/...`, {
        headers: { "x-notion-key": apiKey },
      });
      const text = await r.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        // Got HTML — server still waking up, retry
        if (attemptsLeft > 1 && !cancelled) {
          await new Promise((res) => setTimeout(res, 2000));
          if (!cancelled) tryFetch(attemptsLeft - 1);
        } else if (!cancelled) {
          setError("Server is starting up — pull down to retry");
        }
        return;
      }
      if (cancelled) return;
      if (data.message) throw new Error(data.message);
      setData(data);
    } catch (e: any) {
      if (!cancelled) setError(e.message);
    }
  };

  tryFetch(3);
  return () => { cancelled = true; };
}, [apiKey]);
```

### 7. BASE_URL for API Calls (Expo + Replit)

```tsx
// In component or constants file:
const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";
```

`EXPO_PUBLIC_DOMAIN` is injected at Metro bundle time from the workflow command:
```
EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN pnpm exec expo start ...
```
This means API calls from real devices (Expo Go) hit the same Replit dev domain as the web preview. The domain is publicly accessible — no VPN or tunnelling needed.

### 8. Connecting to Expo Go from a Real Device (No Computer)

The Expo dev server runs in the Replit cloud, not on a local machine. Any device can connect:

1. Open Expo Go → tap "Enter URL manually"
2. Type: `exp://<REPLIT_EXPO_DEV_DOMAIN>` (find in workflow logs under "Metro waiting on")
3. If it won't connect, open the Replit project in a browser first to wake the server, then retry

The Expo URL is in the `artifacts/task-manager: expo` workflow logs every time it starts.

**Current Expo URL**: `exp://814374fd-199d-4ed7-9a1e-8e8568da7f50-00-1sgtb2onftd5g.expo.spock.replit.dev`
(This may change if the Replit container is recycled — always check workflow logs for the current value.)

#### pnpm Monorepo + Expo Go: EXPO_ROUTER_APP_ROOT Fix

**Symptom**: Scanning QR code with Expo Go shows red screen:
> `node_modules/expo-router/_ctx.ios.js: process.env.EXPO_ROUTER_APP_ROOT — First argument of require.context should be a string`

**Root cause**: `babel-preset-expo` (in root workspace `node_modules`) calls `hasModule('expo-router')` via `require.resolve`. In pnpm strict mode, `expo-router` is only in `artifacts/task-manager/node_modules`, invisible from root. Plugin not added → env var not replaced → Metro fails.

**Fix applied (dev script in `package.json`)**:
- Added `NODE_PATH=/home/runner/workspace/artifacts/task-manager/node_modules` — makes Babel workers find `expo-router` via NODE_PATH
- Added `--go` flag to `expo start` — forces Expo Go mode even with `expo-dev-client` in package.json

**Fix applied (`metro.config.js`)**:
- Added `watchFolders: [workspaceRoot]`
- Added `resolver.nodeModulesPaths: [task-manager/node_modules only]`

**Fix applied (`babel.config.js`) — belt-and-suspenders for EAS**:
Added a custom Babel plugin `expoRouterCtxInlinePlugin` that explicitly replaces `process.env.EXPO_ROUTER_APP_ROOT` with the relative path from the `_ctx` file to `app/`, and `process.env.EXPO_ROUTER_IMPORT_MODE` with `'sync'`, for any file whose path includes `/expo-router/_ctx`. This guarantees inlining even if the `babel-preset-expo` Metro caller chain has edge cases in the EAS build environment. The plugin is a safe no-op if `babel-preset-expo` already handled the inlining.

#### pnpm Monorepo + Expo Go: expo-keep-awake Hook Error Fix

**Symptom**: Expo Go shows red screen after the EXPO_ROUTER fix above was applied:
> `[TypeError: Cannot read property 'useId' of null]` from `expo-keep-awake/src/index.ts`

**Root cause**: `withDevTools.ios.tsx` (inside `expo` package) optionally `require()`s `expo-keep-awake`. Metro follows symlinks to the **real path** of `withDevTools.ios.tsx` deep in the pnpm store (`node_modules/.pnpm/expo@.../`), then traverses **up** from that real path when resolving `expo-keep-awake` and `react` — finding the root-workspace copies, not the task-manager's. Those root-workspace React files are different JS objects from the renderer's React → dispatcher is null → hook crash.

**Fix applied (`metro.config.js`)**:
```js
config.resolver.blockList = /.*\/expo-keep-awake\/.*/;
```
Blocking the package entirely causes the `try/catch` in `withDevTools.ios.tsx` to swallow the `require()` failure and fall back to a no-op hook — exactly correct behaviour for Expo Go where keep-awake isn't needed.

#### pnpm Monorepo + Expo Go: Dual-React Instance Fix (resolveRequest)

**Symptom**: Expo Go shows red screen:
> `[TypeError: Cannot read property 'useRef' of null]` from `@react-navigation/core`

**Root cause**: The root workspace has its **own real copy** of `react` at `node_modules/react/` (not a pnpm symlink). When Metro follows pnpm symlinks to real paths and then traverses up from packages in the root workspace (e.g. `@react-navigation/core`), it finds that root copy. The renderer (ReactFabric in `react-native`) uses the pnpm-store copy from the task-manager's local symlink. Two different JS objects = `ReactCurrentDispatcher.current` is null in one instance = hook crash.

**Fix applied (`metro.config.js`)**:
```js
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const override = SINGLETONS[moduleName]; // react, react-dom, scheduler
  if (override) {
    return { type: 'sourceFile', filePath: override }; // pnpm-store real path
  }
  return context.resolveRequest(context, moduleName, platform);
};
```
All `require('react')` calls anywhere in the bundle — regardless of where the importer lives — are forced to the same pnpm-store real file, guaranteeing a single React instance.

### 9. Replit Cold-Start Behaviour

When the project has been idle, Replit puts it to sleep. On wake:
- The API server takes a few seconds to be ready
- Expo Go connecting immediately after wake may fetch schema before the API is up
- Solution: the 3-attempt retry pattern (lesson 6 above) handles this automatically
- User-facing fix: shake device → Reload in Expo Go

### 10. Notion API Integration

- User enters their own Internal Integration Token (`secret_...`) in the Settings screen
- Stored in AsyncStorage via `NotionContext` — persists across app restarts
- API key forwarded to all backend routes via `x-notion-key` header
- Backend proxies all Notion API calls — no Notion API calls are made directly from the app
- The Replit Notion connector was dismissed; if needed again: `connector:ccfg_notion_01K49R392Z3CSNMXCPWSV67AF4`

### 11. EAS Build — MANDATORY PRE-BUILD RULE

> **Before triggering ANY EAS build, read `artifacts/task-manager/EAS_BUILD_GUIDE.md` in full.**
> This is not optional. The guide documents every crash, root cause, and fix from previous builds.
> Verify the checklist below before submitting:
> - [ ] `react-native-keyboard-controller` absent from `package.json` (iOS 26 JSI crash)
> - [ ] `expo-glass-effect`, `expo-symbols`, `expo-location` absent (TurboModule crash)
> - [ ] `newArchEnabled: true` in `app.config.js` (required for Reanimated 4)
> - [ ] `react-native-worklets: 0.5.1` present (required for Reanimated 4)
> - [ ] `NSFaceIDUsageDescription` present in `app.config.js → ios.infoPlist`
> - [ ] `UIBackgroundModes: ['audio']` present in `app.config.js → ios.infoPlist` (NOT app.json — app.json is ignored when app.config.js exists)
> - [ ] `expoRouterCtxInlinePlugin` present in `babel.config.js`
> - [ ] `expo-screen-orientation@~9.0.8` present (landscape in Mi Corazon Viewer — requires native build)
> - [ ] No new native packages added without lockfile sync (`pnpm install --no-frozen-lockfile` from root)
> - [ ] Build command includes `NODE_PATH`, `EAS_NO_VCS=1`, `EAS_SKIP_AUTO_FINGERPRINT=1`

### 11b. EAS Build

#### Working Build Process (as of RN 0.81 + Expo 54)

EAS builds run from a standalone copy at `/tmp/hklife-standalone/`. The critical issue with preview builds: `expo-dev-client` pulls in `EXDevMenu`, which has a React Native 0.81 incompatibility (missing `React-RCTAppDelegate-umbrella.h`). The ONLY reliable fix is to ensure expo-dev-client is absent from BOTH `package.json` AND `package-lock.json` before submission.

**Preview build sequence** (`com.hklife.app`) — the ONLY reliable build method:

```bash
# 1. Recreate standalone
rm -rf /tmp/hklife-standalone
mkdir -p /tmp/hklife-standalone/artifacts/task-manager
cd /home/runner/workspace/artifacts/task-manager
tar --exclude='./node_modules' --exclude='./.git' --exclude='./ios' --exclude='./android' \
  -cf - . | tar -xf - -C /tmp/hklife-standalone/artifacts/task-manager/

cd /tmp/hklife-standalone/artifacts/task-manager

# 2. Resolve catalog: entries and remove expo-dev-client
node -e "
const fs=require('fs');
const yaml=fs.readFileSync('/home/runner/workspace/pnpm-workspace.yaml','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const catalogMap={'@tanstack/react-query':'^5.90.21'};
const lines=yaml.split('\n');let inCatalog=false;
for(const line of lines){if(line.trim()==='catalog:')inCatalog=true;else if(inCatalog&&line.startsWith('  ')){const m=line.match(/^\s+'?([^':]+)'?:\s+(.+)$/);if(m)catalogMap[m[1].trim()]=m[2].trim();}else if(inCatalog&&!line.startsWith(' ')&&line.trim())break;}
for(const sec of['dependencies','devDependencies']){if(!pkg[sec])continue;for(const[k,v] of Object.entries(pkg[sec])){if(v==='catalog:'&&catalogMap[k]){pkg[sec][k]=catalogMap[k];}}}
delete pkg.devDependencies['expo-dev-client'];
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2));
"

# 3. Generate lock file WITHOUT expo-dev-client
npm install --package-lock-only --legacy-peer-deps

# 4. Regenerate ios/ with prebuild
PNPM_MODULES="/home/runner/workspace/node_modules/.pnpm/node_modules"
NODE_PATH="$PNPM_MODULES" node /home/runner/workspace/artifacts/task-manager/node_modules/.bin/expo \
  prebuild --platform ios --no-install --clean

# 5. Create symlinks so EAS CLI can parse app.config.js
mkdir -p node_modules/@expo
WORKSPACE_NM="/home/runner/workspace/artifacts/task-manager/node_modules"
for pkg in "expo-router" "expo" "expo-font" "expo-web-browser" "expo-media-library" "expo-calendar" "expo-image-picker"; do
  ln -sf "$WORKSPACE_NM/$pkg" "node_modules/$pkg" 2>/dev/null || true
done
for pkg in /home/runner/workspace/artifacts/task-manager/node_modules/@expo/*/; do
  ln -sf "$pkg" "node_modules/@expo/$(basename $pkg)" 2>/dev/null || true
done

# 6. Submit
EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform ios --profile preview --non-interactive
```

**Dev client builds**: PERMANENTLY BROKEN due to EXDevMenu/React_RCTAppDelegate umbrella header incompatibility in RN 0.81. All post_install Podfile fixes fail because Clang's module system resolves frameworks from BUILT_PRODUCTS_DIR, not Pods/Headers. Every approach attempted (header copy, fake framework, disable modules, build phase script, no-ios/ submission) consistently fails with the same error. The one historical successful dev build (36b5a49f) appears to have been a lucky EAS worker cache hit and is not reproducible.

**OTA updates (expo-updates)**: Also failing — EAS "Calculate expo-updates runtime version" build phase throws unknown error. Likely a transient or version-compatibility issue. Can be revisited later.

**EAS project**: `@hk1811/hk-life-app`, projectId `a4b0c416-348f-4f50-914c-76e1b191ca72`  
**Apple Team ID**: `LDPV4NPPKY` (hkmail18@gmail.com)  
**Stable bundle ID**: `com.hklife.app` (ad-hoc, existing provisioning)

**Latest builds**:
- Preview `1c961f4b` — IPA: `https://expo.dev/artifacts/eas/4wJPYw93dTMs9nwp6PeCXM.ipa` (2026-04-01, current installed — both iPhone + iPad provisioned)
- Preview `3db84ee0` — IPA: `https://expo.dev/artifacts/eas/8C3wZ9WeBafYqxPhTKutSW.ipa` (2026-04-01, iPhone only)
- Preview `a7fdfa7d` — IPA: `https://expo.dev/artifacts/eas/mKb6FYcCXcxqFJotr2Yhs7.ipa` (2026-04-01, NRL tabs, drawer banner, 2-page news)
- Preview `721cf08b` — IPA: `https://expo.dev/artifacts/eas/f6hFsdnvpZ9fArwDrpRKo4.ipa` (previous)
- Preview `033cea67` — IPA: `https://expo.dev/artifacts/eas/pc3PpyEWkxNigpLAawGTY.ipa` (older)
- Dev client: ALL FAILED — see above

**In-flight build** `3dd081bc` — watch at expo.dev → hk-life-app → Builds. Contains:
- Music controls standardised (62×62 hit area, 30px icons, 16px gap)
- Drag-to-reorder for My Music and Apple Music
- Settings playlist ordering — chevron ▲/▼ buttons for Spotify and Apple Music
- Mi Corazon landscape rotation (expo-screen-orientation)
- **Background audio fix** — `UIBackgroundModes: ['audio']` added to `app.config.js` infoPlist; `interruptionModeIOS` changed to `DoNotMix`

Things that only work in a native EAS build (not Expo Go):
- `keyboardAppearance="dark"` on TextInput
- Face ID (`expo-local-authentication`) — add `NSFaceIDUsageDescription` to `app.json` first
- Splash screen and app icon rendering
- Background audio (music continues when screen is locked / app is backgrounded)
- Mi Corazon landscape rotation (`expo-screen-orientation` is a native module)

### 12. Porting from Scriptable

Scriptable is **not** the permanent home — it is a proof-of-concept prototyping environment. Every script Harry builds in Scriptable is intended to be ported into this Expo app as a proper native screen. When a Scriptable script is shared, treat it as the design spec / behaviour reference for the React Native port.

Completed ports so far: HK Quick Add, IR Quick Add, Mood Log, Win Of The Day, Shazam.

Each port follows the same structure:
- `runLoader(apiPromise)` pattern for saves (spinner → success circle → tick)
- `Keyboard.addListener` + `Animated.Value` for keyboard handling (never KeyboardAvoidingView)
- Absolute-positioned footer driven by `onLayout`
- `ScreenHeader` with native title (no custom red/white header text unless specified)

### 13. URL / Deep Link Preference

When the user asks for URLs (deep links, API endpoints, EAS artifact links, etc.), always present each URL in its own copy-paste code block:

```
hk-life-app://some-screen
```

Never inline URLs as plain text in a sentence when the user has asked for them.

---

## API Server Notion Routes (`artifacts/api-server/src/routes/notion.ts`)

| Route | Purpose |
|-------|---------|
| `GET /api/notion/schema/:dbId` | Detects field types: priType, epicType, priorityType, priOptions |
| `POST /api/notion/pages` | Creates page with Task, Done, Priority, Epic, emoji icon |
| `GET /api/notion/tasks` | Fetches all tasks from a database (paginated) |
| `PATCH /api/notion/tasks/:taskId` | Updates task status |
| `GET /api/notion/databases` | Lists all databases the integration has access to |

All routes forward user key via `x-notion-key` header. All error responses are JSON — never HTML.

---

## Package Reference

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Entry: `src/index.ts`. App setup: `src/app.ts`. Routes in `src/routes/`.

```bash
pnpm --filter @workspace/api-server run dev    # dev server
pnpm --filter @workspace/api-server run build  # esbuild → dist/index.mjs
```

### `artifacts/task-manager` (`@workspace/task-manager`)

```bash
pnpm --filter @workspace/task-manager run dev  # expo start
```

### `lib/db` (`@workspace/db`)

Drizzle ORM + PostgreSQL. `DATABASE_URL` provided automatically by Replit.

```bash
pnpm --filter @workspace/db run push        # apply schema
pnpm --filter @workspace/db run push-force  # force apply
```

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec + Orval codegen. Output goes to `lib/api-client-react` and `lib/api-zod`.

```bash
pnpm --filter @workspace/api-spec run codegen
```
