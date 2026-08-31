import { render, screen } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from './core.ts'
import { I18N_INJECTION_KEY, NULL_I18N, i18nPlugin, useI18n } from './vue.ts'

const Probe = defineComponent({
  setup() {
    const i18n = useI18n()
    return () => i18n.t('greeting')
  },
})

describe('i18nPlugin', () => {
  it('provides the instance it is given', () => {
    const i18n = createI18n({
      locale: 'id',
      fallbackLocale: 'en',
      messages: { en: { greeting: 'Hello' }, id: { greeting: 'Halo' } },
    })
    render(Probe, { global: { plugins: [[i18nPlugin, i18n]] } })
    expect(screen.getByText('Halo')).toBeTruthy()
  })

  it('lets the caller drive the locale through the instance it kept', async () => {
    const i18n = createI18n({
      locale: 'en',
      fallbackLocale: 'en',
      messages: { en: { greeting: 'Hello' }, id: { greeting: 'Halo' } },
    })
    render(Probe, { global: { plugins: [[i18nPlugin, i18n]] } })
    i18n.locale.value = 'id'
    expect(await screen.findByText('Halo')).toBeTruthy()
  })
})

describe('useI18n without an install', () => {
  it('resolves NULL_I18N and renders the key', () => {
    render(Probe)
    expect(screen.getByText('greeting')).toBeTruthy()
  })

  it('does not throw', () => {
    expect(() => render(Probe)).not.toThrow()
  })
})

describe('NULL_I18N', () => {
  it('returns the key from t', () => {
    expect(NULL_I18N.t('anything')).toBe('anything')
  })

  it('formats numbers with en', () => {
    expect(NULL_I18N.n(1234.5)).toBe(new Intl.NumberFormat('en').format(1234.5))
  })
})

describe('I18N_INJECTION_KEY', () => {
  it('is the plain string ADR 0005 requires', () => {
    expect(I18N_INJECTION_KEY as unknown as string).toBe('sentra:i18n')
  })
})
