import { describe, expect, it, vi } from 'vitest'
import { createI18n } from './core.ts'

const messages = {
  en: { greeting: 'Hello', sortBy: 'Sort by {column}' },
  id: { greeting: 'Halo', sortBy: 'Urutkan berdasarkan {column}' },
}

describe('createI18n lookup', () => {
  it('resolves from the active locale', () => {
    const i18n = createI18n({ locale: 'id', fallbackLocale: 'en', messages })
    expect(i18n.t('greeting')).toBe('Halo')
  })

  it('follows the active locale ref reactively', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages })
    expect(i18n.t('greeting')).toBe('Hello')
    i18n.locale.value = 'id'
    expect(i18n.t('greeting')).toBe('Halo')
  })

  it('falls back when the active locale lacks the key', () => {
    const partial = { en: { onlyEnglish: 'Only English' }, id: {} }
    const i18n = createI18n({ locale: 'id', fallbackLocale: 'en', messages: partial })
    expect(i18n.t('onlyEnglish')).toBe('Only English')
  })

  it('returns the key and reports when no locale has it', () => {
    const onMissing = vi.fn()
    const i18n = createI18n({ locale: 'id', fallbackLocale: 'en', messages, onMissing })
    expect(i18n.t('absent')).toBe('absent')
    expect(onMissing).toHaveBeenCalledWith('absent', 'id')
  })

  it('never throws on a missing key without an onMissing handler', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages })
    expect(() => i18n.t('absent')).not.toThrow()
  })
})

describe('createI18n interpolation', () => {
  it('substitutes a named placeholder', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages })
    expect(i18n.t('sortBy', { column: 'Price' })).toBe('Sort by Price')
  })

  it('coerces numeric parameters', () => {
    const i18n = createI18n({
      locale: 'en',
      fallbackLocale: 'en',
      messages: { en: { total: 'Total {n}' } },
    })
    expect(i18n.t('total', { n: 3 })).toBe('Total 3')
  })

  it('leaves an unmatched placeholder literal and reports it', () => {
    const onMissing = vi.fn()
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages, onMissing })
    expect(i18n.t('sortBy')).toBe('Sort by {column}')
    expect(onMissing).toHaveBeenCalledWith('sortBy:column', 'en')
  })
})

const plurals = {
  en: { items: { one: '{count} item', other: '{count} items' } },
  id: { items: { other: '{count} barang' } },
}

describe('createI18n plurals', () => {
  it('selects the English "one" branch', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: plurals })
    expect(i18n.t('items', { count: 1 })).toBe('1 item')
  })

  it('selects the English "other" branch', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: plurals })
    expect(i18n.t('items', { count: 5 })).toBe('5 items')
  })

  it('uses Indonesian "other" for every count, having no "one" branch', () => {
    const i18n = createI18n({ locale: 'id', fallbackLocale: 'en', messages: plurals })
    expect(i18n.t('items', { count: 1 })).toBe('1 barang')
    expect(i18n.t('items', { count: 5 })).toBe('5 barang')
  })

  it('uses "other" when no count is supplied', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: plurals })
    expect(i18n.t('items')).toBe('{count} items')
  })

  /*
   * I2: `en` and `id` alone cannot prove `selectPlural` actually consults the
   * active locale, because `id`'s fixture has no `one` branch — a hardcoded
   * `new Intl.PluralRules('en')` would still land on `?? message.other` and
   * produce the same, correct-looking Indonesian output. `ar` (Arabic — a
   * test fixture only, not a shipped locale; shipped locales are exactly
   * `en` and `id`) genuinely disagrees with English at `count: 2`:
   * `Intl.PluralRules('ar').select(2)` is `'two'`, while
   * `Intl.PluralRules('en').select(2)` is `'other'`. Because both branches
   * below carry distinct text, a hardcoded-`'en'` regression would select
   * `'other'` — a different, wrong string — rather than silently falling
   * through to the same value `'two'` would have produced.
   */
  it('selects a CLDR branch English does not have, proving locale, not a fallback, drove the choice', () => {
    const arabicPlurals = {
      ar: {
        items: { two: '{count} عنصران', other: '{count} عناصر' },
      },
    }
    const i18n = createI18n({ locale: 'ar', fallbackLocale: 'ar', messages: arabicPlurals })
    expect(i18n.t('items', { count: 2 })).toBe('2 عنصران')
  })

  it('returns the key when a plural message has no "other" branch', () => {
    const onMissing = vi.fn()
    const i18n = createI18n({
      locale: 'en',
      fallbackLocale: 'en',
      messages: { en: { broken: { one: 'one only' } } },
      onMissing,
    })
    expect(i18n.t('broken', { count: 7 })).toBe('broken')
    expect(onMissing).toHaveBeenCalledWith('broken', 'en')
  })
})

describe('createI18n formatting', () => {
  it('formats numbers in the active locale', () => {
    const i18n = createI18n({ locale: 'id', fallbackLocale: 'en', messages: {} })
    expect(i18n.n(1234.5)).toBe(new Intl.NumberFormat('id').format(1234.5))
  })

  it('reformats after a locale change', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: {} })
    const english = i18n.n(1234.5)
    i18n.locale.value = 'id'
    expect(i18n.n(1234.5)).toBe(new Intl.NumberFormat('id').format(1234.5))
    expect(i18n.n(1234.5)).not.toBe(english)
  })

  it('formats dates in the active locale', () => {
    const i18n = createI18n({ locale: 'id', fallbackLocale: 'en', messages: {} })
    const date = new Date(Date.UTC(2026, 7, 31))
    expect(i18n.d(date)).toBe(new Intl.DateTimeFormat('id').format(date))
  })

  it('accepts a timestamp as well as a Date', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: {} })
    const stamp = Date.UTC(2026, 7, 31)
    expect(i18n.d(stamp)).toBe(i18n.d(new Date(stamp)))
  })
})
