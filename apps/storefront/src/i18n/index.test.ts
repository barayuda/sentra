import { createI18n } from '@sentra/i18n'
import { describe, expect, it } from 'vitest'
import { appMessages } from './index.ts'

/*
 * These tests exist because the defect they pin produced no error, no warning
 * and no failing test for two tasks: `useI18n()` returns a null implementation
 * whose `t(key)` returns the key, so an unreachable catalogue renders raw keys
 * instead of crashing. Asserting on translated prose — rather than on "it did
 * not throw" — is the only thing that distinguishes a wired catalogue from an
 * unwired one.
 */
describe('appMessages', () => {
  it('resolves a @sentra/ui key to English prose, not to the raw key', () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: appMessages })
    expect(i18n.t('ui.toast.dismiss')).toBe('Dismiss notification')
  })

  it('resolves a @sentra/ui key in Indonesian', () => {
    const i18n = createI18n({ locale: 'id', fallbackLocale: 'en', messages: appMessages })
    expect(i18n.t('ui.toast.dismiss')).toBe('Tutup notifikasi')
  })

  it("still resolves the application's own keys", () => {
    const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: appMessages })
    expect(i18n.t('storefront.header.brand')).toBe('Sentra')
  })
})
