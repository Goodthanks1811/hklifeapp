const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// Block expo-keep-awake so Metro can never resolve it.
// withDevTools.ios.tsx wraps its require() in try/catch and falls back
// to a no-op hook when the package is unavailable — exactly what we want
// in Expo Go where keep-awake causes hook errors due to pnpm's symlink
// traversal landing on the root-workspace React instance.
config.resolver.blockList = /.*\/expo-keep-awake\/.*/;

module.exports = config;
