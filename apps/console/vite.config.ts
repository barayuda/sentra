import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    federation({
      name: 'console',
      filename: 'remoteEntry.js',
      exposes: { './remote': './src/federated/index.ts' },
      /* Off by decision, not by accident — see ADR 0004. Remotes typecheck against
         @sentra/shell-contract's hand-written RemoteModule, so nothing reads
         generated federation types. `@module-federation/vite@1.20.9` defaults `dts`
         on, which produced a #TYPE-001 build failure here (this app also aliases
         `typescript` to a package whose bin is `tsc6`) and a ~5x build-time
         penalty on the storefront. */
      dts: false,
      shared: {
        vue: { singleton: true, requiredVersion: '3.5.42' },
        /* routerKey is a Symbol — see ADR 0005. */
        'vue-router': { singleton: true },
        pinia: { singleton: true },
        '@sentra/ui': { singleton: false },
        '@sentra/tokens': { singleton: false },
        '@sentra/shell-contract': { singleton: false },
      },
    }),
  ],
  /* Required by the sourcemap CI check, and by any useful production trace. */
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
})
