import { beforeEach, describe, expect, it } from 'vitest'
import { persistLocale, readStoredLocale, syncDocumentLang, SUPPORTED_LOCALES } from './locale.ts'

describe('locale helpers', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = 'en'
  })

  it('supports exactly en and id', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(['en', 'id'])
  })

  it('returns null with nothing stored', () => {
    expect(readStoredLocale()).toBeNull()
  })

  it('round-trips a supported locale', () => {
    persistLocale('id')
    expect(readStoredLocale()).toBe('id')
  })

  it('rejects an unsupported stored value rather than trusting it', () => {
    localStorage.setItem('sentra:locale', 'xx')
    expect(readStoredLocale()).toBeNull()
  })

  it('mirrors the locale onto the document element', () => {
    syncDocumentLang('id')
    expect(document.documentElement.lang).toBe('id')
  })
})
