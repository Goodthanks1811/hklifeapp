const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Config plugin that patches the Podfile to fix expo-dev-menu-EXDevMenu
 * header search path issue with React Native 0.81+ (React-RCTAppDelegate
 * merged into React.framework but expo-dev-menu still expects old pod-style
 * headers). Injects the fix INSIDE the existing post_install block.
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
      const marker = '# expo-dev-menu-EXDevMenu-header-fix';
      if (podfile.includes(marker)) return config;

      const fixSnippet = `  ${marker}
  installer.pods_project.targets.each do |target|
    if target.name == 'expo-dev-menu-EXDevMenu'
      target.build_configurations.each do |cfg|
        existing = cfg.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)'
        arr = existing.is_a?(Array) ? existing.dup : [existing]
        unless arr.any? { |p| p.to_s.include?('React.framework/Headers') }
          arr << '"$(BUILT_PRODUCTS_DIR)/React.framework/Headers"'
          arr << '"$(BUILT_PRODUCTS_DIR)/React.framework/PrivateHeaders"'
        end
        cfg.build_settings['HEADER_SEARCH_PATHS'] = arr
      end
    end
  end
`;

      if (podfile.includes('post_install do |installer|')) {
        // Inject INSIDE the existing post_install block before its closing `end`
        // Strategy: replace the last occurrence of `^end` (the post_install end)
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
        console.log('[withExpoDevMenuFix] Injected EXDevMenu header fix into post_install block');
      } else {
        podfile += `\npost_install do |installer|\n${fixSnippet}\nend\n`;
        console.log('[withExpoDevMenuFix] Created new post_install block with EXDevMenu header fix');
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
