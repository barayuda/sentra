import { defineVitestConfig } from '@sentra/config/vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig(
  defineVitestConfig({ environment: 'happy-dom', setupFiles: ['./vitest.setup.ts'] }),
)
