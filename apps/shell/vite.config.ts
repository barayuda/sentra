import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * Whether the reference SDKs are present.
 *
 * `src/mocks/browser.ts` imports `@sentra/sdk-commerce/mocks` and
 * `@sentra/sdk-ops/mocks` to assemble the platform's single mock Service
 * Worker. Both are reference packages (`sentra.role: "reference"`) and
 * `scripts/strip-reference.mjs` deletes them, so on a platform-only tree
 * those two specifiers must resolve to something other than the deleted
 * packages — see the conditional `resolve.alias` below. Externalizing them
 * instead (an earlier version of this file did) makes the build succeed and
 * then fails to resolve the bare specifier in the browser the moment
 * `VITE_SENTRA_MOCKS=true` is set, which is the flag's entire documented
 * purpose — a green build is not proof this path works.
 */
const hasReferenceSdks =
  existsSync(new URL('../../packages/sdk-commerce/package.json', import.meta.url)) &&
  existsSync(new URL('../../packages/sdk-ops/package.json', import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    federation({
      name: 'shell',
      /* Deliberately empty. Remotes are registered at runtime from
         `public/remotes.json` via `registerRemotes()` — see ADR 0004. A
         build-time entry here would defeat the point: adding a remote would
         mean rebuilding and redeploying the host. */
      remotes: {},
      /* Off by decision, not by accident — see ADR 0004. Remotes typecheck against
         @sentra/shell-contract's hand-written RemoteModule, so nothing reads
         generated federation types. `@module-federation/vite@1.20.9` defaults `dts`
         on, which costs roughly 5x the build time; both remotes set this
         explicitly, and the shell matches them. */
      dts: false,
      shared: {
        vue: { singleton: true, requiredVersion: '3.5.42' },
        /* routerKey is a module-level Symbol — see ADR 0005. */
        'vue-router': { singleton: true },
        pinia: { singleton: true },
        /* Not singletons: their injection keys are namespaced strings, which
           resolve by value across duplicated modules. No requiredVersion,
           because every @sentra package is version 0.0.0 — any semver range
           above 0.0.0 is unsatisfiable and federation rejects the share at
           runtime. */
        '@sentra/ui': { singleton: false },
        '@sentra/tokens': { singleton: false },
        '@sentra/shell-contract': { singleton: false },
      },
    }),
  ],
  /* On a platform-only tree, redirect the two reference mock subpaths to a
     local stub with the same export shape instead of leaving the real
     packages unresolved. Aliasing (not externalizing) means the bundler
     always has something real to resolve, so a build with
     `VITE_SENTRA_MOCKS=true` produces a page that actually runs in a
     browser: MSW starts with only the platform's own handlers, which is
     correct — the reference handlers are legitimately absent because the
     reference implementation is. */
  resolve: {
    alias: hasReferenceSdks
      ? {}
      : {
          '@sentra/sdk-commerce/mocks': fileURLToPath(
            new URL('./src/mocks/stubs/sdk-commerce-mocks.ts', import.meta.url),
          ),
          '@sentra/sdk-ops/mocks': fileURLToPath(
            new URL('./src/mocks/stubs/sdk-ops-mocks.ts', import.meta.url),
          ),
        },
  },
  /* Required by the sourcemap CI check, and by any useful production trace.
     No `target` override: neither shipped remote sets one, and the host must
     not be the only container compiled to a different syntax level than the
     code it loads. */
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
})
