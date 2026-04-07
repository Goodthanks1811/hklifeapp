const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Expo config plugin that directly injects the apple-musickit pod into the
 * generated Podfile, bypassing autolinking entirely.
 *
 * This is necessary because pnpm hoists the file: dependency to the workspace
 * root, so expo-modules-autolinking never finds it in the app's node_modules,
 * and searchPaths silently fails in the EAS build environment.
 */
const withAppleMusicKit = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const podLine = "  pod 'apple-musickit', :path => '../modules/apple-musickit'";

      if (!podfile.includes("apple-musickit")) {
        // Insert after the `use_expo_modules!` call which is always present
        podfile = podfile.replace(
          /(\s*use_expo_modules!\s*\n)/,
          `$1${podLine}\n`
        );
        fs.writeFileSync(podfilePath, podfile, 'utf8');
        console.log('[withAppleMusicKit] Injected apple-musickit pod into Podfile');
      } else {
        console.log('[withAppleMusicKit] apple-musickit pod already present in Podfile');
      }

      return config;
    },
  ]);
};

module.exports = withAppleMusicKit;
