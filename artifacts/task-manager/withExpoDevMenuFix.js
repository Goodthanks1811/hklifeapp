const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Config plugin that patches the Podfile post_install block to fix
 * expo-dev-menu-EXDevMenu compilation error with React Native 0.81+.
 *
 * Root cause: expo-dev-menu imports:
 *   #import <React_RCTAppDelegate/React-RCTAppDelegate-umbrella.h>
 * (hyphenated filename), but RN 0.81 CocoaPods generates it as:
 *   React_RCTAppDelegate-umbrella.h  (underscore, no hyphen variant)
 * and merged React-RCTAppDelegate into React.framework.
 *
 * Fix: In post_install, create the missing hyphenated umbrella header as a
 * compatibility shim that re-exports the real individual headers.
 */
module.exports = function withExpoDevMenuFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      if (!fs.existsSync(podfilePath)) return config;

      let podfile = fs.readFileSync(podfilePath, 'utf8');
      const marker = '# expo-dev-menu-RCTAppDelegate-compat-shim';
      if (podfile.includes(marker)) return config;

      // Ruby code that creates the missing umbrella header shim
      const fixSnippet = `
  ${marker}
  require 'fileutils'
  sandbox_pub = installer.sandbox.root.join('Headers', 'Public').to_s
  compat_dir = File.join(sandbox_pub, 'React_RCTAppDelegate')
  FileUtils.mkdir_p(compat_dir)
  hyphen_umbrella = File.join(compat_dir, 'React-RCTAppDelegate-umbrella.h')
  unless File.exist?(hyphen_umbrella)
    possible_src_dirs = [
      File.join(sandbox_pub, 'React-RCTAppDelegate'),
      File.join(sandbox_pub, 'React_RCTAppDelegate'),
      File.join(installer.sandbox.root.to_s, 'Headers', 'Private', 'React-RCTAppDelegate'),
      File.join(installer.sandbox.root.to_s, 'Headers', 'Private', 'React_RCTAppDelegate'),
      File.join(sandbox_pub, 'ReactNativeDependencies', 'React-RCTAppDelegate'),
      File.join(sandbox_pub, 'ReactNativeDependencies', 'React_RCTAppDelegate'),
    ]
    src_dir = possible_src_dirs.find { |d| Dir.exist?(d) }
    if src_dir
      headers = Dir.glob(File.join(src_dir, '*.h'))
        .map { |f| File.basename(f) }
        .reject { |f| f.include?('umbrella') || f.include?('compat') }
        .sort
      content = headers.map { |h| "#import <React_RCTAppDelegate/#{h}>" }.join("\\n")
      File.write(hyphen_umbrella, "#ifdef __OBJC__\\n#import <UIKit/UIKit.h>\\n#endif\\n#{content}\\n")
      puts "[withExpoDevMenuFix] Created compat umbrella (#{headers.size} headers from #{src_dir})"
    else
      underscore_umbrella = File.join(compat_dir, 'React_RCTAppDelegate-umbrella.h')
      if File.exist?(underscore_umbrella)
        File.write(hyphen_umbrella, "#import \\"React_RCTAppDelegate-umbrella.h\\"\\n")
        puts "[withExpoDevMenuFix] Created compat umbrella as alias for underscore version"
      else
        File.write(hyphen_umbrella, "// React-RCTAppDelegate compat shim\\n#ifdef __OBJC__\\n#import <UIKit/UIKit.h>\\n#endif\\n")
        puts "[withExpoDevMenuFix] Created empty compat umbrella (headers not found - build may still work)"
      end
    end
  end
`;

      if (podfile.includes('post_install do |installer|')) {
        // Inject inside the existing post_install block before its final `end`
        const postInstallIdx = podfile.lastIndexOf('post_install do |installer|');
        const endIdx = podfile.indexOf('\nend', postInstallIdx);
        if (endIdx !== -1) {
          podfile =
            podfile.substring(0, endIdx) +
            '\n' +
            fixSnippet +
            podfile.substring(endIdx);
        } else {
          podfile += `\npost_install do |installer|\n${fixSnippet}\nend\n`;
        }
      } else {
        podfile += `\npost_install do |installer|\n${fixSnippet}\nend\n`;
      }

      console.log('[withExpoDevMenuFix] Injected RCTAppDelegate compat shim into Podfile post_install');
      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
