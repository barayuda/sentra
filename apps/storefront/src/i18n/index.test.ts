import { createI18n } from '@sentra/i18n'
import type { ErrorReporter } from '@sentra/plugin-errors'
import { describe, expect, it, vi } from 'vitest'
import { appMessages, createStorefrontI18n, missingTranslationError } from './index.ts'

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

/**
 * M1: `missingTranslationError` (`./index.ts:48-54`) had correct logic and
 * zero coverage — an inverted split (`lastIndexOf` instead of `indexOf`) or
 * swapped branches would go unnoticed. Exported for this test, per the
 * brief; no other restructuring done.
 */
describe('missingTranslationError', () => {
  it('names a missing catalogue key', () => {
    expect(missingTranslationError('storefront.header.brand').message).toBe(
      'missing translation: storefront.header.brand',
    )
  })

  it('names a missing interpolation parameter, distinctly from a missing key', () => {
    expect(
      missingTranslationError('storefront.cartDrawer.decreaseQuantity:productTitle').message,
    ).toBe(
      'missing interpolation parameter "productTitle" for translation: storefront.cartDrawer.decreaseQuantity',
    )
  })
})

/** A minimal spy reporter — only `report` is asserted on here. */
function spyReporter(): ErrorReporter & {
  report: ReturnType<typeof vi.fn<ErrorReporter['report']>>
} {
  return { report: vi.fn<ErrorReporter['report']>(), count: 0 }
}

describe('createStorefrontI18n onMissing wiring', () => {
  it('reports a missing key through missingTranslationError', () => {
    const reporter = spyReporter()
    const i18n = createStorefrontI18n(reporter)

    i18n.t('totally.unknown.key')

    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'missing translation: totally.unknown.key' }),
      { key: 'totally.unknown.key', locale: 'en' },
    )
  })

  it('reports a missing interpolation parameter through missingTranslationError', () => {
    const reporter = spyReporter()
    const i18n = createStorefrontI18n(reporter)

    /* No `productTitle` supplied — `storefront.cartDrawer.decreaseQuantity`
       (`./en.json`) requires one. */
    i18n.t('storefront.cartDrawer.decreaseQuantity')

    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'missing interpolation parameter "productTitle" for translation: storefront.cartDrawer.decreaseQuantity',
      }),
      { key: 'storefront.cartDrawer.decreaseQuantity:productTitle', locale: 'en' },
    )
  })
})
