import type { FlagDeclarations, FlagSource } from '@sentra/flags'
import type { OpsClient } from '@sentra/sdk-ops'

/** Every flag this console evaluates, with its behaviour when nothing answers. */
export const CONSOLE_FLAGS = {
  'orders.bulkActions': { default: false },
} as const satisfies FlagDeclarations

/**
 * Adapts the ops administration client to the evaluation seam.
 *
 * The adapter lives here, not in `@sentra/flags`, because the wire shape
 * belongs to `@sentra/sdk-ops` — a reference package. A platform package that
 * knew that shape would be coupled to a reference contract, and
 * `strip-reference.mjs` would delete the thing it depends on.
 */
export function createOpsFlagSource(ops: OpsClient): FlagSource {
  return {
    async load() {
      const result = await ops.listFlags()
      /*
       * A fresh Error, not the result's own: the adapter then depends on no
       * field of that value, and a transport message — which may carry a URL —
       * never travels into an error report.
       */
      if (!result.ok) throw new Error('flag evaluation source unavailable')
      return Object.fromEntries(result.value.map((flag) => [flag.key, flag.enabled]))
    },
  }
}
