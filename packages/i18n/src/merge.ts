import type { Message, Messages } from './types.ts'

/**
 * Merges catalogues, unioning locales.
 *
 * A duplicate key within a locale throws. An application silently overwriting a
 * library key is precisely the failure this package exists to prevent, and a
 * silent overwrite of an accessibility label would be invisible in every visual
 * check.
 *
 * @throws {Error} When two sources define the same key in the same locale.
 */
export function mergeMessages(...sources: readonly Messages[]): Messages {
  const result: Record<string, Record<string, Message>> = {}
  for (const source of sources) {
    for (const [locale, catalogue] of Object.entries(source)) {
      const target = (result[locale] ??= {})
      for (const [key, message] of Object.entries(catalogue)) {
        if (key in target) {
          throw new Error(`duplicate message key "${key}" in locale "${locale}"`)
        }
        target[key] = message
      }
    }
  }
  return result
}
