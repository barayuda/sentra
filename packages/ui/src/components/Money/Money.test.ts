import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import Money from './Money.vue'

describe('Money', () => {
  it('formats a number with currency symbol and minor units', () => {
    render(Money, { props: { amount: 1250.5, currency: 'USD', locale: 'en-US' } })
    expect(screen.getByText('$1,250.50')).toBeTruthy()
  })

  it('parses Shopify-style decimal strings', () => {
    render(Money, { props: { amount: '129.00', currency: 'USD', locale: 'en-US' } })
    expect(screen.getByText('$129.00')).toBeTruthy()
  })

  it('matches the runtime Intl output exactly (locale rules are Intl-owned)', () => {
    render(Money, { props: { amount: 250000, currency: 'IDR', locale: 'id-ID' } })
    const expected = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(250000)
    expect(screen.getByTestId('money').textContent).toBe(expected)
  })

  it('exposes the raw amount machine-readably', () => {
    render(Money, { props: { amount: '129.00', currency: 'USD', locale: 'en-US' } })
    expect(screen.getByTestId('money').getAttribute('data-amount')).toBe('129')
  })

  it('renders an em dash for an unparseable amount instead of NaN', () => {
    render(Money, { props: { amount: 'not-a-number', currency: 'USD', locale: 'en-US' } })
    expect(screen.getByTestId('money').textContent).toBe('—')
  })

  it('renders an em-dash for an empty amount string rather than zero', () => {
    const { getByTestId } = render(Money, { props: { amount: '', currency: 'USD' } })
    expect(getByTestId('money').textContent).toBe('—')
  })

  it('renders an em-dash for a whitespace-only amount', () => {
    const { getByTestId } = render(Money, { props: { amount: '   ', currency: 'USD' } })
    expect(getByTestId('money').textContent).toBe('—')
  })
})
