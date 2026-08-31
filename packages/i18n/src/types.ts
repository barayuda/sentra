import type { Ref } from 'vue'

/**
 * A message with one branch per CLDR plural category.
 *
 * `Partial` is deliberate: Indonesian has a single category (`other`) and must
 * not be forced to invent a `one` branch the language does not have.
 */
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>>

/** A catalogue entry: a plain string, or one branch per plural category. */
export type Message = string | PluralMessage

/** One locale's messages, keyed by message key. */
export type Catalogue = Readonly<Record<string, Message>>

/** Every locale's catalogue, keyed by locale code. */
export type Messages = Readonly<Record<string, Catalogue>>

/** Interpolation parameters. `count` additionally drives plural selection. */
export type TranslateParams = Readonly<Record<string, string | number>>

/**
 * The seam.
 *
 * Four members, because this is what an alternative implementation — `vue-i18n`,
 * say — must provide to sit behind `'sentra:i18n'`.
 */
export interface I18nSource {
  readonly locale: Ref<string>
  t(key: string, params?: TranslateParams): string
  n(value: number, options?: Intl.NumberFormatOptions): string
  d(value: Date | number, options?: Intl.DateTimeFormatOptions): string
}

/** Options for {@link createI18n}. */
export interface CreateI18nOptions {
  readonly locale: string
  readonly fallbackLocale: string
  readonly messages: Messages
  /**
   * Called for a key with no message in either locale, and for a placeholder
   * with no matching parameter (as `` `${key}:${name}` ``). Never throws.
   */
  readonly onMissing?: (key: string, locale: string) => void
}
