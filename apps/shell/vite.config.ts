import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

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
  /* Required by the sourcemap CI check, and by any useful production trace.
     No `target` override: neither shipped remote sets one, and the host must
     not be the only container compiled to a different syntax level than the
     code it loads. */
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
})
