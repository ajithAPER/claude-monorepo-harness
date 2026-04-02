/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require('@yarnpkg/types');

module.exports = defineConfig({
  constraints: async ({ Yarn }) => {
    // Enforce consistent versions: if two workspaces depend on the same
    // package, they must use the same version range.
    for (const dependency of Yarn.dependencies()) {
      if (dependency.type === 'peerDependencies') continue;
      for (const otherDependency of Yarn.dependencies({ ident: dependency.ident })) {
        if (otherDependency.type === 'peerDependencies') continue;
        dependency.update(otherDependency.range);
      }
    }
  },
});
