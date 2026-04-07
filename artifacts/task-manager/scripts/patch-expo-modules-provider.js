/**
 * Patches ExpoModulesProvider.swift (already written by the autolinking tool)
 * to inject AppleMusicKitModule.self into the getModuleClasses() return array.
 *
 * Called from expo-configure-project.sh (appended by ensure-local-modules.js
 * during eas-build-post-install) so it runs immediately after the autolinking
 * tool writes ExpoModulesProvider.swift — before Swift compilation picks it up.
 *
 * Why this is needed: pnpm hoists file: deps to the workspace root, so
 * expo-modules-autolinking never finds apple-musickit in the project's
 * node_modules, and therefore never adds AppleMusicKitModule to the provider.
 * The Swift class DOES exist in the compiled pod (podspec: ios/**\/*.swift),
 * so once the reference is injected, compilation succeeds.
 *
 * SCRIPT_OUTPUT_FILE_0 is exported by Xcode into the shell environment before
 * the [Expo] Configure project build-phase script runs.
 */

const fs = require("fs");

const outputFile = process.env.SCRIPT_OUTPUT_FILE_0;

if (!outputFile) {
  console.error("[patch-expo-modules-provider] SCRIPT_OUTPUT_FILE_0 not set — skipping");
  process.exit(0);
}

if (!fs.existsSync(outputFile)) {
  console.error("[patch-expo-modules-provider] File not found:", outputFile, "— skipping");
  process.exit(0);
}

let content = fs.readFileSync(outputFile, "utf8");

if (content.includes("AppleMusicKitModule")) {
  console.log("[patch-expo-modules-provider] AppleMusicKitModule already present — no patch needed");
  process.exit(0);
}

// 1. Inject the import statement so Swift can resolve AppleMusicKitModule.
//    Pod named "apple-musickit" → Swift module name "apple_musickit" (hyphens → underscores).
//    Insert after the last existing import line.
const importLine = "import apple_musickit";
const lastImportIdx = content.lastIndexOf("\nimport ");
if (lastImportIdx === -1) {
  console.error("[patch-expo-modules-provider] Could not find any import lines in", outputFile);
  process.exit(0);
}
// Find the end of that last import line
const afterLastImport = content.indexOf("\n", lastImportIdx + 1);
content =
  content.slice(0, afterLastImport) +
  "\n" + importLine +
  content.slice(afterLastImport);

// 2. Inject the class reference into getModuleClasses() return [...]
const idx1 = content.indexOf("getModuleClasses");
const idx2 = content.indexOf("return [", idx1);

if (idx1 === -1 || idx2 === -1) {
  console.error("[patch-expo-modules-provider] Could not find 'getModuleClasses … return [' in", outputFile);
  process.exit(0);
}

const insertAt = idx2 + "return [".length;
content =
  content.slice(0, insertAt) +
  "\n    AppleMusicKitModule.self," +
  content.slice(insertAt);

fs.writeFileSync(outputFile, content, "utf8");
console.log("[patch-expo-modules-provider] ✅ Injected import apple_musickit + AppleMusicKitModule.self into", outputFile);
