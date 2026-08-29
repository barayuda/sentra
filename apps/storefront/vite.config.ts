import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    federation({
      name: 'storefront',
      filename: 'remoteEntry.js',
      exposes: { './remote': './src/federated/index.ts' },
      /* Off by decision, not by accident — see ADR 0004. Remotes typecheck against
         @sentra/shell-contract's hand-written RemoteModule, so nothing reads
         generated federation types, and Task 1's spike measured DTS at ~5.2s of a
         ~5.5s build. Leaving it on also fails #TYPE-001 here, because this app
         aliases `typescript` to a package whose bin is `tsc6`. */
      dts: false,
      shared: {
        vue: { singleton: true, requiredVersion: '3.5.42' },
        /* routerKey is a Symbol — a duplicated copy makes useRouter() return
           undefined with no error. See ADR 0005. */
        'vue-router': { singleton: true },
        /* piniaSymbol plus a module-level `activePinia`; a second copy has its
           own unset activePinia. */
        pinia: { singleton: true },
        /* Not singletons: their injection keys are namespaced strings, which
           resolve by value across duplicated modules. No requiredVersion,
           because every @sentra package is version 0.0.0 — see Ruling G. */
        '@sentra/ui': { singleton: false },
        '@sentra/tokens': { singleton: false },
        '@sentra/shell-contract': { singleton: false },
      },
    }),
  ],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    /* The E2E suite and the Lighthouse gate in M5 both read this directory.
       Task 1's spike found chrome89 sufficient for federation's runtime; no
       raise recorded. */
    outDir: 'dist',
    sourcemap: true,
  },
})
