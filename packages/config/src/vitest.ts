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
  const { environment = 'node', setupFiles = [] } = options

  return {
    test: {
      environment,
      setupFiles,
      /** Explicit imports only — implicit globals hide where helpers come from. */
      globals: false,
      coverage: {
        provider: 'v8' as const,
        reporter: ['text', 'json-summary'] as const,
        exclude: ['**/*.test.ts', '**/*.stories.ts', '**/dist/**'],
      },
    },
  }
}
