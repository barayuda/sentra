import type { Message, Messages } from '@sentra/i18n'
import en from './en.json'
import id from './id.json'

/** Every key the library ships. Derived from `en`, which is the reference. */
export type UiMessageKey = keyof typeof en

/*
 * Typing `id` against the reference's key union is what makes a *missing*
 * translation a compile error. The catalogue gate covers what this cannot see:
 * a translation that typechecks but drops a `{placeholder}`.
 */
const idTyped: Record<UiMessageKey, Message> = id

/** The library's catalogues, ready for `mergeMessages`. */
export const uiMessages: Messages = { en, id: idTyped }
