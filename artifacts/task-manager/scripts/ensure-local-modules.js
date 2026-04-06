/**
 * Ensures local native modules are present in the project's own node_modules
 * so that expo-modules-autolinking can find and compile them during expo prebuild.
 *
 * pnpm hoists `file:` dependencies to the workspace root, so the app-level
 * autolinking scan never sees them. This script symlinks (or recursively copies)
 * each module into the project's node_modules before prebuild runs.
 *
 * Run: node scripts/ensure-local-modules.js
 */

const fs   = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const LOCAL_MODULES = [
  "apple-musickit",
];

function copyRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

for (const name of LOCAL_MODULES) {
  const src = path.join(PROJECT_ROOT, "modules", name);
  const dst = path.join(PROJECT_ROOT, "node_modules", name);

  if (!fs.existsSync(src)) {
    console.warn(`[ensure-local-modules] Source not found: ${src} — skipping`);
    continue;
  }

  // Remove existing entry (could be a broken symlink or stale copy from a
  // previous build) so we always get a fresh, correct version.
  try {
    const stat = fs.lstatSync(dst);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(dst, { recursive: true, force: true });
    }
  } catch {
    // dst doesn't exist — nothing to remove
  }

  // Try symlink first (fast, always in sync with source)
  try {
    fs.symlinkSync(src, dst, "dir");
    console.log(`[ensure-local-modules] Symlinked ${name} → node_modules/`);
    continue;
  } catch {
    // Symlink not supported in this environment — fall through to copy
  }

  // Recursive copy fallback (handles ios/, src/, and any nested directories)
  try {
    copyRecursive(src, dst);
    console.log(`[ensure-local-modules] Copied ${name} → node_modules/ (recursive)`);
  } catch (e) {
    console.error(`[ensure-local-modules] Failed to copy ${name}:`, e);
    process.exit(1);
  }
}
