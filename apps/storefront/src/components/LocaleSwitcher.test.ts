import { createI18n, i18nPlugin } from '@sentra/i18n'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import LocaleSwitcher from './LocaleSwitcher.vue'
import { storefrontMessages } from '../i18n/index.ts'

function renderSwitcher() {
  const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: storefrontMessages })
  render(LocaleSwitcher, { global: { plugins: [[i18nPlugin, i18n]] } })
  return i18n
}

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = 'en'
  })

  it('switches the active locale', async () => {
    const i18n = renderSwitcher()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'id')
    expect(i18n.locale.value).toBe('id')
  })

  it('persists the choice', async () => {
    renderSwitcher()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'id')
    expect(localStorage.getItem('sentra:locale')).toBe('id')
  })

  it('mirrors the choice onto the document element', async () => {
    renderSwitcher()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'id')
    expect(document.documentElement.lang).toBe('id')
  })
})
