import { defineVitestConfig } from '@sentra/config/vitest'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  ...defineVitestConfig({ environment: 'happy-dom', setupFiles: ['./vitest.setup.ts'] }),
})
