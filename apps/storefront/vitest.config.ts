import { defineVitestConfig } from '@sentra/config/vitest'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  ...defineVitestConfig({ environment: 'happy-dom', setupFiles: ['./vitest.setup.ts'] }),
  test: {
    ...defineVitestConfig({ environment: 'happy-dom', setupFiles: ['./vitest.setup.ts'] }).test,
    /* Playwright specs live in e2e/ and are run by `pnpm e2e`, not Vitest.
       Without this exclusion Vitest tries to execute them and fails on
       @playwright/test's own runner globals. */
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
