import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    /* The E2E suite and the Lighthouse gate in M5 both read this directory. */
    outDir: 'dist',
    sourcemap: true,
  },
})
