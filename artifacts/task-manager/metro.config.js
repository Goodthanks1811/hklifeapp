const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// Block expo-keep-awake — withDevTools.ios.tsx wraps its require() in
// try/catch and falls back to a no-op, so blocking is safe.
config.resolver.blockList = /.*\/expo-keep-awake\/.*/;

// Build a map of singleton packages → their canonical real-file entry point.
// These packages must resolve to a single JS object across the whole bundle.
// Without this, Metro follows pnpm symlinks to real paths and packages in
// the root-workspace (e.g. @react-navigation/core) end up importing the
// root-workspace's plain copy of react — a completely different JS object
// from the pnpm-store copy used by react-native's renderer → hook crashes.
function resolveEntry(localPath) {
  const real = fs.realpathSync(localPath);
  const pkg = require(path.join(real, "package.json"));
  const main = pkg.main || "index.js";
  return path.join(real, main);
}

const localModules = path.resolve(projectRoot, "node_modules");
const SINGLETONS = {};
for (const pkg of ["react", "react-dom", "scheduler"]) {
  try {
    SINGLETONS[pkg] = resolveEntry(path.join(localModules, pkg));
  } catch {
    // package not locally installed — leave unoverridden
  }
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const override = SINGLETONS[moduleName];
  if (override) {
    return { type: "sourceFile", filePath: override };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
