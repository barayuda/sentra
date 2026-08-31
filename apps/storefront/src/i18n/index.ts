import { mergeMessages, type Message, type Messages } from '@sentra/i18n'
import { uiMessages } from '@sentra/ui/i18n'
import en from './en.json'
import id from './id.json'

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
