const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Expo config plugin for the AppleMusicKit native module.
 *
 * WHY this approach (main app target, not a pod):
 *   pnpm hoists file: deps to the workspace root, so expo-modules-autolinking
 *   never finds apple-musickit. The pod approach required importing a static
 *   library Swift module across targets, which silently fails without
 *   use_frameworks!. Putting the Swift file directly in the main app target
 *   (HKLifeApp) means it's in the same compilation unit as
 *   ExpoModulesProvider.swift — no import needed, no cross-target visibility
 *   issues. ExpoModulesCore is already linked in the main app target, so
 *   `import ExpoModulesCore` inside the Swift file works fine.
 *
 * HOW it works:
 *   1. withDangerousMod copies AppleMusicKitModule.swift into ios/HKLifeApp/
 *   2. withXcodeProject adds the file to the main app target's Compile Sources
 *   3. patch-expo-modules-provider.js (called from expo-configure-project.sh
 *      via ensure-local-modules.js) injects AppleMusicKitModule.self into the
 *      ExpoModulesProvider.swift generated at Xcode build time
 *   4. requireNativeModule("AppleMusicKit") finds the registered module at
 *      runtime via ExpoModulesCore
 */

const SWIFT_FILENAME = 'AppleMusicKitModule.swift';

const withAppleMusicKit = (config) => {
  // Step 1: Copy the Swift source file into ios/HKLifeApp/ during prebuild
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot, projectRoot } = config.modRequest;
      const srcFile = path.join(
        projectRoot, 'modules', 'apple-musickit', 'ios', SWIFT_FILENAME
      );
      const appDir = path.join(platformProjectRoot, 'HKLifeApp');
      const dstFile = path.join(appDir, SWIFT_FILENAME);

      fs.mkdirSync(appDir, { recursive: true });
      fs.copyFileSync(srcFile, dstFile);
      console.log(`[withAppleMusicKit] Copied ${SWIFT_FILENAME} → ios/HKLifeApp/`);

      return config;
    },
  ]);

  // Step 2: Register the Swift file with the Xcode project so it gets compiled
  // as part of the HKLifeApp target's Compile Sources build phase.
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const filePath = path.join('HKLifeApp', SWIFT_FILENAME);

    if (!xcodeProject.hasFile(filePath)) {
      xcodeProject.addSourceFile(filePath, {}, xcodeProject.pbxGroupByName('HKLifeApp'));
      console.log(`[withAppleMusicKit] Added ${SWIFT_FILENAME} to Xcode project`);
    } else {
      console.log(`[withAppleMusicKit] ${SWIFT_FILENAME} already registered`);
    }

    return config;
  });

  return config;
};

module.exports = withAppleMusicKit;
