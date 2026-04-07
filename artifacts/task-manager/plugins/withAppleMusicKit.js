const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const SWIFT_FILENAME = 'AppleMusicKitModule.swift';

/**
 * 1. withDangerousMod: copies AppleMusicKitModule.swift into ios/HKLifeApp/
 *    so it lives in the same Xcode target as ExpoModulesProvider.swift.
 *    No cross-target import needed — same compilation unit.
 *
 * 2. withXcodeProject: adds the file to the main target's Compile Sources
 *    build phase so Xcode actually compiles it.
 *    - Uses pbxFileReferenceSection() to check for duplicates (hasFile does
 *      not exist on the xcode package's project object).
 *    - pbxGroupByName may return null; addSourceFile omits the group arg in
 *      that case — the file still gets added to PBXBuildFileSection and
 *      PBXSourcesBuildPhase (compilation), just not to the nav group tree.
 */
const withAppleMusicKit = (config) => {
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot, projectRoot } = config.modRequest;
      const srcFile = path.join(projectRoot, 'modules', 'apple-musickit', 'ios', SWIFT_FILENAME);
      const appDir = path.join(platformProjectRoot, 'HKLifeApp');
      const dstFile = path.join(appDir, SWIFT_FILENAME);

      fs.mkdirSync(appDir, { recursive: true });
      fs.copyFileSync(srcFile, dstFile);
      console.log(`[withAppleMusicKit] Copied ${SWIFT_FILENAME} → ios/HKLifeApp/`);

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const filePath = path.join('HKLifeApp', SWIFT_FILENAME);

    // Check if file reference already exists — hasFile() is not in the API,
    // use pbxFileReferenceSection() instead.
    const refs = xcodeProject.pbxFileReferenceSection();
    const alreadyAdded = Object.values(refs).some(
      (ref) =>
        ref &&
        typeof ref === 'object' &&
        ref.path &&
        String(ref.path).replace(/"/g, '') === SWIFT_FILENAME
    );

    if (!alreadyAdded) {
      // pbxGroupByName returns null if not found; addSourceFile still adds to
      // PBXSourcesBuildPhase (compilation) even without a group.
      const group = xcodeProject.pbxGroupByName('HKLifeApp');
      xcodeProject.addSourceFile(filePath, {}, group || undefined);
      console.log(`[withAppleMusicKit] Added ${SWIFT_FILENAME} to Xcode project`);
    } else {
      console.log(`[withAppleMusicKit] ${SWIFT_FILENAME} already registered in Xcode project`);
    }

    return config;
  });

  return config;
};

module.exports = withAppleMusicKit;
