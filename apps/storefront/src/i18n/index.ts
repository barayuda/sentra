import type { Message, Messages } from '@sentra/i18n'
import en from './en.json'
import id from './id.json'

/** Every key this application ships. Derived from `en`, the reference. */
export type StorefrontMessageKey = keyof typeof en

const idTyped: Record<StorefrontMessageKey, Message> = id

/** This application's catalogues, ready for `mergeMessages`. */
export const storefrontMessages: Messages = { en, id: idTyped }
