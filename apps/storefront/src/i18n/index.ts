import {
  createI18n,
  mergeMessages,
  type I18nSource,
  type Message,
  type Messages,
} from '@sentra/i18n'
import type { ErrorReporter } from '@sentra/plugin-errors'
import { uiMessages } from '@sentra/ui/i18n'
import en from './en.json'
import id from './id.json'
import { readStoredLocale } from './locale.ts'

/** Every key this application ships. Derived from `en`, the reference. */
export type StorefrontMessageKey = keyof typeof en

/*
 * Typing `id` against the reference's key union is what makes a *missing*
 * translation a compile error. The catalogue gate covers what this cannot see:
 * a translation that typechecks but drops a `{placeholder}`.
 */
const idTyped: Record<StorefrontMessageKey, Message> = id

/** This application's own catalogues. */
export const storefrontMessages: Messages = { en, id: idTyped }

/**
 * Everything the running application must be able to translate: this app's
 * catalogue plus the component library's.
 *
 * One exported constant rather than a `mergeMessages` call repeated in
 * `main.ts` and `vitest.setup.ts`, so a test can pin what production actually
 * resolves. Merging at module scope also means a key collision between the
 * `ui.*` and `storefront.*` namespaces throws on import — `mergeMessages`
 * (`packages/i18n/src/merge.ts:19-21`) rejects a duplicate key within a locale
 * — rather than silently letting one catalogue shadow the other.
 */
export const appMessages: Messages = mergeMessages(uiMessages, storefrontMessages)

/**
 * `onMissing` (`packages/i18n/src/types.ts:41-45`) fires for two different
 * failures through the same hook: a key with no message in either locale, and
 * a placeholder with no matching parameter, in which case `key` arrives as
 * `` `${key}:${name}` ``. Reporting both as "missing translation: <key>" would
 * make the second case read as a catalogue entry that was never missing —
 * naming the parameter and the actual key separately says what really failed.
 */
function missingTranslationError(key: string): Error {
  const separator = key.indexOf(':')
  if (separator === -1) return new Error(`missing translation: ${key}`)
  const messageKey = key.slice(0, separator)
  const param = key.slice(separator + 1)
  return new Error(`missing interpolation parameter "${param}" for translation: ${messageKey}`)
}

/**
 * Builds this application's i18n instance.
 *
 * The single construction path for both the standalone entry point
 * (`main.ts`) and the federated one (`federated/register.ts`), so the two
 * cannot drift into independently-tuned `createI18n` calls for the same
 * application. `messages` is always `appMessages` — the strict superset of
 * `@sentra/ui`'s `uiMessages` plus this application's own catalogue — never
 * `uiMessages` alone, so neither entry point can silently lose the
 * `storefront.*` keys the other relies on.
 *
 * @param reporter - Where a missing key or interpolation parameter is
 *   reported. Both call sites already have one in scope by the time they call
 *   this: `main.ts` installs `errorsPlugin` first, and the federated entry
 *   runs after the shell has done the same.
 */
export function createStorefrontI18n(reporter: ErrorReporter): I18nSource {
  return createI18n({
    locale: readStoredLocale() ?? 'en',
    fallbackLocale: 'en',
    messages: appMessages,
    onMissing: (key, locale) => {
      reporter.report(missingTranslationError(key), { key, locale })
    },
  })
}
