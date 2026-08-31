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
