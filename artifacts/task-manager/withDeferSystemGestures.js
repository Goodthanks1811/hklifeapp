const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

/**
 * Config plugin: defer iOS system edge-swipe gestures app-wide.
 *
 * Problem: on iPhones without a home button, swiping horizontally along the
 * bottom bar (home indicator area) triggers the "switch apps" system gesture
 * before the app can claim the touch — this hijacks video scrubber drags and
 * similar horizontal gestures near the bottom of the screen.
 *
 * Fix: set `preferredScreenEdgesDeferringSystemGestures` to UIRectEdgeAll on
 * UIViewController via an Objective-C category. This tells iOS to wait for the
 * app's gesture recognisers to run first before activating system gestures.
 * The category applies automatically to every UIViewController subclass that
 * doesn't explicitly override this property (e.g. AVPlayerViewController keeps
 * its own override, so video playback isn't double-affected).
 *
 * This requires an EAS build — the Expo Go client does not load this plugin.
 */

const FILE_NAME = 'DeferSystemGestures.m';

const OBJC_SOURCE = `\
#import <UIKit/UIKit.h>

// App-wide deferral of iOS system edge gestures.
// Prevents the "swipe along home indicator to switch apps" gesture from
// stealing touches that belong to the app (e.g. video scrubber, horizontal
// sliders near the bottom of the screen).
@implementation UIViewController (DeferSystemGestures)

- (UIRectEdge)preferredScreenEdgesDeferringSystemGestures {
  return UIRectEdgeAll;
}

@end
`;

module.exports = function withDeferSystemGestures(config) {

  // ── Step 1: Write the .m file into the iOS app folder ────────────────────
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const appDir  = path.join(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName);
      const outPath = path.join(appDir, FILE_NAME);
      if (!fs.existsSync(outPath)) {
        fs.mkdirSync(appDir, { recursive: true });
        fs.writeFileSync(outPath, OBJC_SOURCE, 'utf8');
        console.log(`[withDeferSystemGestures] Wrote ${outPath}`);
      }
      return cfg;
    },
  ]);

  // ── Step 2: Register the file in the Xcode project ───────────────────────
  config = withXcodeProject(config, (cfg) => {
    const proj        = cfg.modResults;
    const projectName = cfg.modRequest.projectName;
    const filePath    = `${projectName}/${FILE_NAME}`;

    // Skip if already registered
    if (proj.pbxFileByPath(filePath)) return cfg;

    // Find the main app group key
    const groupKey = proj.findPBXGroupKey({ name: projectName });
    proj.addSourceFile(filePath, {}, groupKey);
    console.log(`[withDeferSystemGestures] Added ${FILE_NAME} to Xcode project`);
    return cfg;
  });

  return config;
};
