# Workspace

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

### Screens

| File | Purpose |
|------|---------|
| `app/(tabs)/index.tsx` | Task Board — Notion tasks grouped by status |
| `app/settings.tsx` | API key entry with eye-toggle, status dot, clear; gear icon in drawer bottom |
| `app/ir-quick-add.tsx` | IR Quick Add script port — navy/gold theme |
| `app/ui-kit/` | UI Kit showcase: Buttons, Sliders, Drag & Reorder, Loaders, Modals |

### Key Components

| File | Purpose |
|------|---------|
| `components/Drawer.tsx` | Hamburger slide-in drawer |
| `context/NotionContext.tsx` | API key + tasks via AsyncStorage |
| `context/DrawerContext.tsx` | Drawer open/close state |
| `constants/colors.ts` | Shared colour tokens |

### Drawer Structure

NAVIGATION → Task Board  
Scripts → IR Quick Add  
UI KIT (Buttons / Sliders / Drag & Reorder / Loaders / Modals)  
─── divider ───  
Settings (gear icon, pinned to bottom)

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

### 11. EAS Build

```bash
eas login
eas init          # only needed once per project
eas build --platform ios --profile preview
```

Things that only work in a native EAS build (not Expo Go):
- `keyboardAppearance="dark"` on TextInput
- Face ID (`expo-local-authentication`) — add `NSFaceIDUsageDescription` to `app.json` first
- Splash screen and app icon rendering

### 12. Future Scripts to Port

The user has more Scriptable scripts to port — all are Notion integrations, none are widgets. Each new script follows the same structure as IR Quick Add:
- Navy/gold theme
- `runLoader(apiPromise)` pattern for saves
- Keyboard + footer pattern
- Tablet responsive column

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
