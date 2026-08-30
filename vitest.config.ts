import { defineConfig } from 'vitest/config'

/*
 * Root Vitest project, scoped to the gate scripts under `scripts/`.
 *
 * These scripts are not a workspace member — they are plain Node run by CI
 * steps — so `turbo run test` never sees them. Without this project the gate
 * logic would be the only untested code in the repository, which is exactly
 * backwards: a gate that is wrong fails open and nobody notices.
 */
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs'],
    environment: 'node',
    globals: false,
  },
})
