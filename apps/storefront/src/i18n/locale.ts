/** The locales this application ships. */
export const SUPPORTED_LOCALES = ['en', 'id'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/** Where the chosen locale persists between visits. */
const STORAGE_KEY = 'sentra:locale'

/**
 * Reads the stored locale, or `null` when absent or unrecognised.
 *
 * An unrecognised value is treated as absent rather than passed through: it is
 * attacker-influenced input (anyone can write to `localStorage`), and feeding it
 * to `Intl` constructors would throw on a malformed tag.
 */
export function readStoredLocale(): SupportedLocale | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return SUPPORTED_LOCALES.includes(stored as SupportedLocale) ? (stored as SupportedLocale) : null
}

/** Persists the chosen locale. */
export function persistLocale(locale: SupportedLocale): void {
  localStorage.setItem(STORAGE_KEY, locale)
}

/**
 * Mirrors the locale onto `<html lang>`.
 *
 * Not decoration: `html-has-lang` is an axe rule the accessibility gate enforces
 * at `minScore 0.98`, and a locale switch that leaves `lang="en"` on an
 * Indonesian page misinforms every screen reader on the page.
 */
export function syncDocumentLang(locale: SupportedLocale): void {
  document.documentElement.lang = locale
}
