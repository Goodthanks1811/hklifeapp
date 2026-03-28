# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

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
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Task Manager App (`artifacts/task-manager`)

Expo / React Native mobile app targeting iPhone + iPad Pro 12.9". Bold red (`#E03131`) + black main theme.

### Screens
- `app/(tabs)/index.tsx` — Task Board (Notion tasks grouped by status)
- `app/settings.tsx` — API key entry screen (accessible from drawer bottom)
- `app/ir-quick-add.tsx` — IR Quick Add script port (navy `#0C1846` / gold `#FE9A01` theme)
- `app/ui-kit/` — UI Kit showcase: Buttons, Sliders, Drag & Reorder, Loaders, Modals

### Key Components & Patterns
- `components/Drawer.tsx` — hamburger slide-in drawer with NAVIGATION / Scripts / UI KIT / Settings sections
- `context/NotionContext.tsx` — API key + tasks stored in AsyncStorage; `setApiKey`, `clearConfig`
- `context/DrawerContext.tsx` — drawer open/close state with animated slide

### IR Quick Add screen details
- DB ID: `2c9b7eba35238084a6decf83993961e4`; logo: `https://i.postimg.cc/rwCNn1YJ/4375900A-530F-472F-8D00-3C573594C990.png`
- Loader animation: overlay fade-in → spinning ring → circle pop (easeOutBack) → check tick → hold → fade out
  - Timing constants: T_FADE_IN=200, T_SPINNER_IN=250, T_MIN_SPIN=900, T_POP=380, T_TICK=350, T_HOLD=700, T_FADE_OUT=400
  - Loader starts immediately on save tap; API call runs in parallel; min spin enforced
- Keyboard: `Keyboard.addListener("keyboardWillShow/Hide")` + `Animated.Value` for footer `bottom` and content `marginBottom`; no KeyboardAvoidingView
- Footer: `position: absolute`, height measured via `onLayout`
- Responsive: `useWindowDimensions` → `isTablet = width >= 768` → content centred in `maxWidth: 720` column
- Status bar visible (no custom header); floating hamburger at `top: topPad + 10, left: 16`

### API Server Notion routes (`artifacts/api-server/src/routes/notion.ts`)
- `GET /api/notion/schema/:dbId` — detects field types (priType, epicType, priorityType, priOptions)
- `POST /api/notion/pages` — creates page with Task, Done, Priority, Epic, emoji icon fields
- All routes forward user key via `x-notion-key` header

### Notion Integration
The app uses a direct Notion API key (Internal Integration Token) entered by the user in the Settings screen. The Replit Notion connector was dismissed — if reconnecting in the future, use `connector:ccfg_notion_01K49R392Z3CSNMXCPWSV67AF4`. The current approach (user-entered API key stored in AsyncStorage) works well for a personal task manager.

The backend proxies all Notion API calls through `/api/notion/*` routes, forwarding the user's key via `x-notion-key` header.

### EAS Build
`app.json` has EAS configured. User needs `eas login` + `eas init` then `eas build --platform ios --profile preview` for standalone deployment. `keyboardAppearance="dark"` requires a native build to take effect (not Expo Go).

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
