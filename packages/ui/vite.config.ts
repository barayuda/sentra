import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // Declarations are emitted by a separate `vue-tsc` step in the `build`
  // script, not by a Vite plugin. vite-plugin-dts runs plain TypeScript, which
  // cannot resolve `*.vue` imports: it reported eleven TS2307 errors, emitted
  // declarations for only the five non-SFC modules, and still let the build
  // exit 0. `vue-tsc` understands SFCs, emits all eighteen, and exits non-zero
  // when resolution fails — so the gate reports failure when it fails.
  plugins: [vue(), tailwindcss()],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    // Vue stays external so the host application supplies the single shared
    // instance. Bundling it here would create a second reactivity system across
    // the federation boundary in M4 — see spec ADR D4.
    rollupOptions: { external: ['vue'] },
  },
})
