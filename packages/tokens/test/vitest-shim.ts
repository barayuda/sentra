/**
 * Lets the unchanged Vitest suite run under Jest: `moduleNameMapper` points
 * the `vitest` specifier here, and this module re-exports Jest's equivalents.
 *
 * `describe` / `it` are drop-in compatible, but the suite exercises two
 * Vitest-only `expect` features that Jest's `expect` rejects outright:
 * `expect(actual, customMessage)`'s optional second argument (Jest throws
 * "Expect takes at most one argument"), and the `toBeTypeOf` matcher (not a
 * Jest built-in). Both are polyfilled below so the test files stay
 * byte-for-byte unchanged — that gap, not a clean 1:1 API match, is the
 * finding ADR 0002 documents.
 */
import { describe, expect as jestExpect, it } from '@jest/globals'

type JestExpect = typeof jestExpect

/**
 * Drops Vitest's optional custom-message second argument before delegating
 * to Jest's `expect`. The pass/fail outcome is unaffected; only Jest's own
 * failure-message text differs from what Vitest would have shown.
 */
const expect = ((actual: unknown, _customMessage?: string) => jestExpect(actual)) as JestExpect

Object.assign(expect, jestExpect)

/**
 * `toBeTypeOf` has no Jest built-in equivalent, so it is added via Jest's
 * own `expect.extend` — a one-matcher polyfill rather than a compatibility
 * package.
 */
jestExpect.extend({
  toBeTypeOf(received: unknown, expected: string) {
    const pass = typeof received === expected
    return {
      pass,
      message: () =>
        `expected ${String(received)} ${pass ? 'not ' : ''}to be of type "${expected}"`,
    }
  },
})

export { describe, it, expect }
