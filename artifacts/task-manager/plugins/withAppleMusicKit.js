const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Adds AppleMusicKitModule.swift directly to the main app target (HKLifeApp)
 * so it compiles in the same Swift module as ExpoModulesProvider.swift.
 * No cross-target imports needed. No xcode package API calls — pure string
 * manipulation on project.pbxproj so there are no API compatibility issues.
 *
 * patch-expo-modules-provider.js (called from expo-configure-project.sh via
 * ensure-local-modules.js) then injects AppleMusicKitModule.self into the
 * ExpoModulesProvider.swift generated at Xcode build time.
 */

const SWIFT_FILENAME = 'AppleMusicKitModule.swift';

// Deterministic 24-char hex UUIDs — stable across builds.
const FILE_UUID  = 'AA11BB22CC33DD44EE55FF01';
const BUILD_UUID = 'AA11BB22CC33DD44EE55FF02';

const SWIFT_CONTENT = fs.readFileSync(
  path.join(__dirname, '../modules/apple-musickit/ios/AppleMusicKitModule.swift'),
  'utf8'
);



const withAppleMusicKit = (config) => {
  // ── Guarantee UIBackgroundModes: ['audio'] is in Info.plist ──────────────
  // Belt-and-suspenders: withInfoPlist fires during the info-plist phase;
  // the second withDangerousMod below fires LAST (after everything) and
  // directly patches the XML file on disk — nothing can overwrite it after.
  config = withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    if (!Array.isArray(plist.UIBackgroundModes)) plist.UIBackgroundModes = [];
    if (!plist.UIBackgroundModes.includes('audio')) plist.UIBackgroundModes.push('audio');
    return cfg;
  });

  // ── 0. Fix react-native-spotify-remote arm64 linker failure ──────────────
  //
  // SpotifyiOS.framework ships ONLY i386/armv7/x86_64 (no arm64). Every iOS
  // device since iPhone 5s is arm64 → linker fails with "fat file missing
  // arch 'arm64'". The package also ships SpotifyiOS.xcframework whose
  // ios-arm64_armv7 slice IS a valid fat binary containing arm64 + armv7.
  //
  // Strategy: overwrite the broken binary inside SpotifyiOS.framework with
  // the arm64-capable binary from the xcframework slice. This keeps the
  // podspec path unchanged (no CocoaPods xcframework handling needed) while
  // giving the linker the arm64 symbols it needs.
  //
  // TWO layers to survive any pnpm reinstall that may happen during Prebuild:
  //   Layer 1 — withDangerousMod (runs during expo prebuild, before pod install)
  //   Layer 2 — Podfile post_install hook (runs after pod install, before Xcode)
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const spotifyBase = path.join(
        projectRoot, 'node_modules', 'react-native-spotify-remote',
        'ios', 'external', 'SpotifySDK',
      );
      const srcFramework  = path.join(spotifyBase, 'SpotifyiOS.xcframework', 'ios-arm64_armv7', 'SpotifyiOS.framework');
      const destFramework = path.join(spotifyBase, 'SpotifyiOS.framework');

      // Layer 1: copy the ENTIRE arm64 xcframework slice into SpotifyiOS.framework
      // before pod install.  Copies binary + Info.plist + Modules + Headers so
      // Xcode's "did not contain an Info.plist" error is prevented.
      if (fs.existsSync(srcFramework) && fs.existsSync(destFramework)) {
        try {
          const entries = fs.readdirSync(srcFramework);
          for (const entry of entries) {
            const src  = path.join(srcFramework, entry);
            const dest = path.join(destFramework, entry);
            const stat = fs.statSync(src);
            if (stat.isDirectory()) {
              fs.cpSync(src, dest, { recursive: true, force: true });
            } else {
              fs.copyFileSync(src, dest);
            }
          }
          console.log('[withAppleMusicKit] Layer 1: copied full arm64 xcframework slice into SpotifyiOS.framework ✓ (' + entries.join(', ') + ')');
        } catch (e) {
          console.warn('[withAppleMusicKit] Layer 1 framework copy failed:', e.message);
        }
      } else {
        console.warn('[withAppleMusicKit] Layer 1: SpotifyiOS framework paths not found — skipping');
      }

      // ── Patch react-native-worklets/scripts/worklets_utils.rb ────────────────
      // worklets_utils.rb line 73 uses `File.path('./src/featureFlags/staticFlags.json')`
      // which is a CWD-relative path.  When CocoaPods runs `pod install`, the CWD is
      // the ios/ directory — NOT the worklets package root — so this raises:
      //   "[Worklets] Feature flags file not found at ./src/featureFlags/staticFlags.json"
      // and pod install exits with code 1 in ~2 seconds.
      // Fix: replace the CWD-relative path with a __dir__-relative absolute path so
      // it works regardless of where `pod install` is invoked from.
      const workletsUtilsPath = path.join(
        projectRoot, 'node_modules', 'react-native-worklets', 'scripts', 'worklets_utils.rb'
      );
      if (fs.existsSync(workletsUtilsPath)) {
        const bad  = "static_feature_flags_path = File.path('./src/featureFlags/staticFlags.json')";
        const good = "static_feature_flags_path = File.expand_path('../src/featureFlags/staticFlags.json', __dir__)";
        let rb = fs.readFileSync(workletsUtilsPath, 'utf8');
        if (rb.includes(bad)) {
          fs.writeFileSync(workletsUtilsPath, rb.replace(bad, good), 'utf8');
          console.log('[withAppleMusicKit] Patched worklets_utils.rb: staticFlags path is now __dir__-relative ✓');
        } else if (rb.includes(good)) {
          console.log('[withAppleMusicKit] worklets_utils.rb already patched ✓');
        } else {
          console.warn('[withAppleMusicKit] worklets_utils.rb: staticFlags line not found — patch skipped');
        }
      } else {
        console.log('[withAppleMusicKit] react-native-worklets not present — skipping worklets_utils patch');
      }

      // Layer 2a: PREPEND a Ruby-level worklets_utils.rb patch to the Podfile.
      // This runs in the same Ruby process as pod install, BEFORE CocoaPods
      // loads any podspecs — so it patches the file before worklets raises.
      // __dir__ inside the Podfile = the ios/ directory.
      // Node.js __dirname equivalent: File.dirname(__FILE__) or __dir__ in Ruby.
      // The patch is idempotent (marker prevents double-insertion on re-runs).
      const podfilePath = path.join(platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        const workletsRubyMarker = '# [HKLifeApp] worklets_utils.rb patch';
        let podfile = fs.readFileSync(podfilePath, 'utf8');
        if (!podfile.includes(workletsRubyMarker)) {
          const workletsRubyPatch = `${workletsRubyMarker}
# Patches react-native-worklets@0.5.x bug: File.path('./src/featureFlags/staticFlags.json')
# is CWD-relative; pod install runs from ios/ so it fails. Fix it to use __dir__.
begin
  _wu_path = File.expand_path('../node_modules/react-native-worklets/scripts/worklets_utils.rb', __dir__)
  if File.exist?(_wu_path)
    _wu_content = File.read(_wu_path)
    _wu_bad  = "static_feature_flags_path = File.path('./src/featureFlags/staticFlags.json')"
    _wu_good = "static_feature_flags_path = File.expand_path('../src/featureFlags/staticFlags.json', __dir__)"
    if _wu_content.include?(_wu_bad)
      File.write(_wu_path, _wu_content.gsub(_wu_bad, _wu_good))
      puts '[HKLifeApp] Patched worklets_utils.rb: staticFlags path is now __dir__-relative \u2713'
    end
  end
rescue => _wu_err
  puts "[HKLifeApp] Warning: worklets_utils.rb patch failed: #{_wu_err.message}"
end

`;
          // Prepend so it runs before any require/use_native_modules calls
          fs.writeFileSync(podfilePath, workletsRubyPatch + podfile, 'utf8');
          console.log('[withAppleMusicKit] Layer 2a: prepended worklets_utils.rb Ruby patch to Podfile ✓');
        } else {
          console.log('[withAppleMusicKit] Layer 2a: Podfile already has worklets_utils.rb patch');
        }

        // Re-read in case we just modified it
        podfile = fs.readFileSync(podfilePath, 'utf8');

        // Layer 2b: inject SpotifyiOS binary swap INTO the existing post_install block.
        // CocoaPods 1.16.2 made multiple post_install hooks an error. We must merge
        // into the single existing post_install block that react_native_post_install uses.
        // Anchor: the closing ')' + '  end' + 'end' that closes post_install + target.
        const spotifyMarker = '# [HKLifeApp] SpotifyiOS arm64 fix';
        if (!podfile.includes(spotifyMarker)) {
          const spotifyCode = `
    ${spotifyMarker}
    require 'fileutils'
    _spotify_base     = File.join(__dir__, '..', 'node_modules', 'react-native-spotify-remote', 'ios', 'external', 'SpotifySDK')
    _spotify_src_fw   = File.join(_spotify_base, 'SpotifyiOS.xcframework', 'ios-arm64_armv7', 'SpotifyiOS.framework')
    _spotify_dest_fw  = File.join(_spotify_base, 'SpotifyiOS.framework')
    if File.exist?(_spotify_src_fw) && File.exist?(_spotify_dest_fw)
      Dir.glob("#{_spotify_src_fw}/*").each do |src_entry|
        FileUtils.cp_r(src_entry, _spotify_dest_fw)
      end
      puts '[HKLifeApp] Layer 2b: copied full arm64 xcframework slice into SpotifyiOS.framework \u2713'
    end`;
          // Expo always generates this exact closing pattern for the post_install block:
          //   "    )\n  end\nend\n"  (react_native_post_install close → post_install end → target end)
          // We insert our code between the last ')' and the post_install 'end'.
          const anchor = '\n  end\nend\n';
          const anchorIdx = podfile.lastIndexOf(anchor);
          if (anchorIdx !== -1) {
            podfile = podfile.slice(0, anchorIdx) + spotifyCode + '\n' + podfile.slice(anchorIdx);
            fs.writeFileSync(podfilePath, podfile, 'utf8');
            console.log('[withAppleMusicKit] Layer 2b: injected SpotifyiOS fix into existing post_install ✓');
          } else {
            console.warn('[withAppleMusicKit] Layer 2b: could not find post_install closing anchor — skipping');
          }
        } else {
          console.log('[withAppleMusicKit] Layer 2b: Podfile already has SpotifyiOS fix');
        }
      } else {
        console.warn('[withAppleMusicKit] Layer 2: Podfile not found — cannot patch');
      }

      return config;
    },
  ]);

  // ── 1. Swift file + pbxproj patching ──────────────────────────────────────
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;

      // ── 1. Write AppleMusicKitModule.swift to ios/ root ──────────────────
      // The PBXFileReference uses sourceTree="<group>" with path=filename only,
      // which resolves relative to the Xcode project root (ios/).
      // Writing to ios/HKLifeApp/ would need a group entry to resolve correctly;
      // ios/ root matches the bare path entry we inject into the pbxproj.

      // Inject HK artwork as base64 so the lock screen / Dynamic Island can
      // display it without any Xcode asset catalog changes.
      const { projectRoot } = config.modRequest;
      const pngPath = path.join(projectRoot, 'assets', 'images', 'hk-artwork-transparent.png');
      let swiftContent = SWIFT_CONTENT;
      if (fs.existsSync(pngPath)) {
        const pngBase64 = fs.readFileSync(pngPath).toString('base64');
        swiftContent = swiftContent.replace('HK_ARTWORK_BASE64_PLACEHOLDER', pngBase64);
        console.log(`[withAppleMusicKit] Injected HK artwork base64 (${pngBase64.length} chars) into Swift`);
      } else {
        console.warn('[withAppleMusicKit] hk-artwork-transparent.png not found — artwork will fall back to AppIcon');
      }

      fs.writeFileSync(path.join(platformProjectRoot, SWIFT_FILENAME), swiftContent, 'utf8');
      console.log(`[withAppleMusicKit] Wrote ${SWIFT_FILENAME} → ios/`);

      // ── 2. Register it in project.pbxproj via string manipulation ─────────
      const entries = fs.readdirSync(platformProjectRoot);
      const xcodeprojDir = entries.find((e) => e.endsWith('.xcodeproj'));
      if (!xcodeprojDir) {
        console.error('[withAppleMusicKit] No .xcodeproj found — skipping pbxproj patch');
        return config;
      }

      const pbxprojPath = path.join(platformProjectRoot, xcodeprojDir, 'project.pbxproj');
      let pbx = fs.readFileSync(pbxprojPath, 'utf8');

      if (pbx.includes(SWIFT_FILENAME)) {
        console.log(`[withAppleMusicKit] ${SWIFT_FILENAME} already in project.pbxproj`);
        return config;
      }

      // a) PBXFileReference
      pbx = pbx.replace(
        '/* End PBXFileReference section */',
        `\t\t${FILE_UUID} /* ${SWIFT_FILENAME} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${SWIFT_FILENAME}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`
      );

      // b) PBXBuildFile
      pbx = pbx.replace(
        '/* End PBXBuildFile section */',
        `\t\t${BUILD_UUID} /* ${SWIFT_FILENAME} in Sources */ = {isa = PBXBuildFile; fileRef = ${FILE_UUID} /* ${SWIFT_FILENAME} */; };\n/* End PBXBuildFile section */`
      );

      // c) PBXSourcesBuildPhase — insert into the files = ( ... ) list.
      //    The Sources phase contains "isa = PBXSourcesBuildPhase" followed by
      //    a "files = (" list. Inject our build-file entry right after "files = (".
      pbx = pbx.replace(
        /(isa = PBXSourcesBuildPhase;[\s\S]*?files = \()/,
        `$1\n\t\t\t\t${BUILD_UUID} /* ${SWIFT_FILENAME} in Sources */,`
      );

      fs.writeFileSync(pbxprojPath, pbx, 'utf8');
      console.log(`[withAppleMusicKit] Patched project.pbxproj with ${SWIFT_FILENAME}`);

      return config;
    },
  ]);

  // ── 2. Direct Info.plist XML patch — runs LAST, after all Expo mods ───────
  // Dangerous mods execute after info-plist mods, so the file already exists.
  // Directly patching the XML on disk is the only approach guaranteed to survive
  // Expo's built-in infoPlist processing overwriting our changes.
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;

      // Find Info.plist — search every immediate subdirectory of ios/ rather
      // than hardcoding the app-name folder (which can vary between builds).
      let infoPlistPath = null;
      try {
        const entries = fs.readdirSync(platformProjectRoot);
        for (const entry of entries) {
          const candidate = path.join(platformProjectRoot, entry, 'Info.plist');
          if (fs.existsSync(candidate)) {
            infoPlistPath = candidate;
            console.log(`[withAppleMusicKit] Found Info.plist at: ${candidate}`);
            break;
          }
        }
      } catch (e) {
        console.warn('[withAppleMusicKit] Error scanning for Info.plist:', e.message);
      }

      if (!infoPlistPath) {
        console.warn('[withAppleMusicKit] Info.plist not found — UIBackgroundModes patch skipped');
        return config;
      }

      let plist = fs.readFileSync(infoPlistPath, 'utf8');

      if (plist.includes('<key>UIBackgroundModes</key>')) {
        if (!plist.includes('<string>audio</string>')) {
          // Key exists but audio string is missing — inject into the array
          plist = plist.replace(
            /(<key>UIBackgroundModes<\/key>\s*<array>)/,
            '$1\n\t\t<string>audio</string>'
          );
          fs.writeFileSync(infoPlistPath, plist, 'utf8');
          console.log('[withAppleMusicKit] Injected <string>audio</string> into UIBackgroundModes ✓');
        } else {
          console.log('[withAppleMusicKit] UIBackgroundModes:audio already present ✓');
        }
      } else {
        // Key missing entirely — append full block before </dict></plist>.
        // Try multiple closing-tag patterns to handle different plist whitespace styles.
        const replacements = [
          [/\t<\/dict>\n<\/plist>\s*$/, '\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>audio</string>\n\t</array>\n\t</dict>\n</plist>\n'],
          [/<\/dict>\n<\/plist>\s*$/, '<key>UIBackgroundModes</key>\n<array>\n<string>audio</string>\n</array>\n</dict>\n</plist>\n'],
          [/<\/dict><\/plist>\s*$/, '<key>UIBackgroundModes</key><array><string>audio</string></array></dict></plist>'],
        ];
        let patched = false;
        for (const [pattern, replacement] of replacements) {
          if (pattern.test(plist)) {
            plist = plist.replace(pattern, replacement);
            patched = true;
            break;
          }
        }
        if (patched) {
          fs.writeFileSync(infoPlistPath, plist, 'utf8');
          console.log('[withAppleMusicKit] Injected UIBackgroundModes:audio into Info.plist ✓');
        } else {
          console.error('[withAppleMusicKit] FAILED to inject UIBackgroundModes — no closing-tag pattern matched');
          // Last resort: append raw XML at end of file
          plist += '\n<!-- UIBackgroundModes injected by withAppleMusicKit -->\n';
          fs.appendFileSync(infoPlistPath.replace('Info.plist', 'UIBackgroundModes.debug'), plist);
          console.log('[withAppleMusicKit] Dumped plist to debug file for inspection');
        }
      }
      return config;
    },
  ]);
};

module.exports = withAppleMusicKit;
