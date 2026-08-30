/**
 * Options accepted by {@link defineVitestConfig}.
 */
export interface SentraVitestOptions {
  /**
   * DOM environment for the test run.
   *
   * Use `'node'` for pure logic packages such as `@sentra/tokens`, and
   * `'happy-dom'` for packages that mount Vue components.
   *
   * @defaultValue `'node'`
   */
  environment?: 'node' | 'happy-dom'
  /**
   * Paths to files executed once before the suite, resolved relative to the
   * consuming package root.
   *
   * @defaultValue `[]`
   */
  setupFiles?: string[]
  /**
   * Whether to exclude the Playwright suites — `e2e/` and `e2e-platform-only/` —
   * from the Vitest run.
   *
   * Set this in any package that has both a Vitest suite and a Playwright
   * suite. Without it Vitest picks up the `e2e/` specs and dies on
   * `@playwright/test`'s runner globals — and because Turborepo reports the
   * failing package's exit code while the passing packages print their
   * green counts, the run looks green and exits 1. That exact failure shipped
   * once; centralising the exclusion is what stops it shipping twice.
   *
   * @defaultValue `false`
   */
  excludeE2E?: boolean
}

/**
 * Builds the Vitest configuration shared by every Sentra workspace.
 *
 * Centralising this keeps coverage reporters and globals consistent across
 * packages, so CI can apply one gate to all of them. Returns a plain object
 * rather than calling Vitest's own `defineConfig`, which keeps the function
 * trivially unit-testable.
 *
 * @param options - Per-package overrides.
 * @returns A Vitest configuration fragment for spreading into `defineConfig`.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'vitest/config'
 * import { defineVitestConfig } from '@sentra/config/vitest'
 *
 * export default defineConfig(defineVitestConfig({ environment: 'happy-dom' }))
 * ```
 */
export function defineVitestConfig(options: SentraVitestOptions = {}) {
  const { environment = 'node', setupFiles = [], excludeE2E = false } = options

  return {
    test: {
      environment,
      setupFiles,
      /** Explicit imports only — implicit globals hide where helpers come from. */
      globals: false,
      /* Naming `exclude` replaces Vitest's default rather than extending it,
         so `node_modules/**` must be repeated here or dependency tests start
         running. */
      ...(excludeE2E ? { exclude: ['e2e/**', 'e2e-platform-only/**', 'node_modules/**'] } : {}),
      coverage: {
        provider: 'v8' as const,
        reporter: ['text', 'json-summary'],
        exclude: ['**/*.test.ts', '**/*.stories.ts', '**/dist/**'],
      },
    },
  }
}
