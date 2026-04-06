/**
 * Ensures local native modules (file: dependencies that pnpm hoists to the
 * workspace root) are also present in the project's own node_modules so that
 * expo-modules-autolinking can find them during expo prebuild.
 *
 * pnpm's publicHoistPattern=['*'] moves everything to the workspace root,
 * which means expo prebuild's autolinking scan (relative to the project
 * directory) never sees these local modules and never compiles their Swift code.
 *
 * Run: node scripts/ensure-local-modules.js
 */

const fs   = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const LOCAL_MODULES = [
  "apple-musickit",
];

for (const name of LOCAL_MODULES) {
  const src = path.join(PROJECT_ROOT, "modules", name);
  const dst = path.join(PROJECT_ROOT, "node_modules", name);

  if (!fs.existsSync(src)) {
    console.warn(`[ensure-local-modules] Source not found: ${src} — skipping`);
    continue;
  }

  if (fs.existsSync(dst)) {
    console.log(`[ensure-local-modules] ${name} already in node_modules — OK`);
    continue;
  }

  try {
    fs.symlinkSync(src, dst, "dir");
    console.log(`[ensure-local-modules] Linked ${name} → node_modules/`);
  } catch (e) {
    // Fallback: copy if symlink fails (some EAS envs restrict symlinks)
    fs.mkdirSync(dst, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      fs.copyFileSync(path.join(src, file), path.join(dst, file));
    }
    console.log(`[ensure-local-modules] Copied ${name} → node_modules/`);
  }
}
