const path = require('path');

/**
 * Inline EXPO_ROUTER_APP_ROOT and EXPO_ROUTER_IMPORT_MODE as string literals
 * for expo-router _ctx files. Metro's collect-dependencies requires require.context()
 * first arg to be a static StringLiteral – babel-preset-expo's expo-router-plugin
 * already does this via the Metro caller, but we add an explicit belt-and-suspenders
 * plugin here to guarantee it works even when the caller chain has edge cases
 * (e.g., EAS build environment differences).
 */
function expoRouterCtxInlinePlugin(api) {
  const t = api.types;
  const projectRoot =
    api.caller((c) => c?.projectRoot) ||
    process.env.EXPO_PROJECT_ROOT ||
    process.cwd();

  return {
    name: 'expo-router-ctx-inline',
    visitor: {
      MemberExpression(nodePath, state) {
        const filename = state.filename || state.file?.opts?.filename;
        if (!filename) return;

        // Only patch expo-router _ctx files
        const normalised = filename.replace(/\\/g, '/');
        if (!normalised.includes('/expo-router/_ctx')) return;

        const obj = nodePath.node.object;
        if (!t.isMemberExpression(obj)) return;
        const root = obj.object;
        if (!t.isIdentifier(root) || root.name !== 'process') return;
        if (!t.isIdentifier(obj.property) || obj.property.name !== 'env') return;
        if (
          t.isAssignmentExpression(nodePath.parent) &&
          nodePath.parent.left === nodePath.node
        )
          return;

        const key = nodePath.toComputedKey();
        if (!t.isStringLiteral(key)) return;

        switch (key.value) {
          case 'EXPO_ROUTER_APP_ROOT': {
            const appFolder = path.join(projectRoot, 'app');
            const rel = path.relative(path.dirname(filename), appFolder);
            nodePath.replaceWith(t.stringLiteral(rel));
            break;
          }
          case 'EXPO_ROUTER_IMPORT_MODE': {
            nodePath.replaceWith(t.stringLiteral('sync'));
            break;
          }
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [expoRouterCtxInlinePlugin, 'react-native-worklets/plugin'],
  };
};
