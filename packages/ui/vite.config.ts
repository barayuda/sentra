import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), tailwindcss(), dts({ tsconfigPath: './tsconfig.build.json' })],
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
