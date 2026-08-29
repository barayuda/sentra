import { defineVitestConfig } from '@sentra/config/vitest'
import { defineConfig } from 'vitest/config'

/**
 * The default environment is `node`: the SDK core is framework- and
 * DOM-agnostic, and testing it in node is what proves that. The two specs
 * that genuinely need a DOM (`sanitize.test.ts`, `vue/queries.test.ts`) opt
 * in per file with a `@vitest-environment happy-dom` docblock.
 */
export default defineConfig({
  ...defineVitestConfig({ environment: 'node' }),
})
