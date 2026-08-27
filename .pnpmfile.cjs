'use strict'

/**
 * typescript-eslint@8.68.0 (and every `@typescript-eslint/*` package it pulls
 * in) throws at *import time* — not just a warning — when it detects
 * TypeScript >= 7. Root `typescript` is pinned to 7.0.2 (M1 policy), and
 * `packageExtensions` cannot override this because `typescript` is already
 * declared as a `peerDependencies` entry in these packages' own manifests:
 * pnpm resolves the ambient peer (7.0.2, allowed via `peerDependencyRules`)
 * ahead of anything `packageExtensions.dependencies` injects for the same
 * name, so the injected dependency is silently dropped.
 *
 * This hook rewrites those manifests before pnpm resolves them: it removes
 * the `typescript` peer and replaces it with a real, local dependency on the
 * `@typescript/typescript6` alias — the same "run the TS 6 API side-by-side
 * with TS 7" pattern typescript-eslint's own error message points to, and
 * the same pattern `packages/ui` already uses for `vue-tsc`. Node's module
 * resolution then finds this local `typescript` before ever walking up to
 * the root's real typescript@7.0.2, so every other consumer is unaffected.
 */
const TS6_ALIAS = 'npm:@typescript/typescript6@6.0.2'

const AFFECTED_PACKAGES = new Set([
  'typescript-eslint',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  '@typescript-eslint/type-utils',
  '@typescript-eslint/typescript-estree',
  '@typescript-eslint/project-service',
  '@typescript-eslint/tsconfig-utils',
  '@typescript-eslint/utils',
])

function readPackage(pkg) {
  if (AFFECTED_PACKAGES.has(pkg.name)) {
    if (pkg.peerDependencies) delete pkg.peerDependencies.typescript
    if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.typescript
    pkg.dependencies = { ...pkg.dependencies, typescript: TS6_ALIAS }
  }
  return pkg
}

module.exports = {
  hooks: { readPackage },
}
