import type { EventSchema } from '@sentra/shell-contract'

/** Compares two category lists by value, order-insensitively. */
function sameCategories(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((value, index) => value === right[index])
}

/**
 * Merges every remote's analytics schema into the one the shell installs.
 *
 * Identical redeclaration is allowed on purpose: every remote emits
 * `page_view`, and forcing one of them to own it would make the analytics
 * schema a shared build-time dependency — the exact coupling federation is
 * supposed to remove.
 *
 * Disagreement throws, at boot, loudly. Two remotes that think `page_view`
 * belongs to different categories will each pass their own validation and
 * then silently write inconsistent data for as long as nobody looks at the
 * dashboard. A boot-time throw is the cheapest place to find that.
 *
 * @param schemas - One schema per loaded remote.
 * @throws When two remotes declare the same event with different categories.
 */
export function mergeEventSchemas(schemas: readonly EventSchema[]): EventSchema {
  const merged: Record<string, readonly string[]> = {}
  for (const schema of schemas) {
    for (const [event, categories] of Object.entries(schema)) {
      const existing = merged[event]
      if (existing && !sameCategories(existing, categories)) {
        throw new Error(
          `[sentra] analytics event "${event}" is declared twice with different categories: ` +
            `[${existing.join(', ')}] and [${categories.join(', ')}]`,
        )
      }
      merged[event] = categories
    }
  }
  return merged
}
