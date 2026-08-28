import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import AppHeader from './AppHeader.vue'

/**
 * The visible `({{ itemCount }})` span and the `sr-only` count text both used
 * to contribute to the cart button's accessible name, which meant a screen
 * reader announced the count twice ("Cart (3) 3 items in cart") and got the
 * plural wrong at one ("Cart 1 items in cart"). `aria-hidden` on the visible
 * span makes the `sr-only` span the single source of truth for what is
 * announced, so these tests assert the accessible NAME rather than the
 * visible text.
 */
function renderHeader(itemCount: number) {
  return render(AppHeader, {
    props: { itemCount },
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
}

describe('AppHeader', () => {
  it('announces an empty cart without a stray count', () => {
    const { getByRole } = renderHeader(0)
    const button = getByRole('button', { name: /^Cart empty$/ })
    expect(button).toBeTruthy()
  })

  it('announces a singular item without a trailing s', () => {
    const { getByRole } = renderHeader(1)
    const button = getByRole('button', { name: /^Cart 1 item$/ })
    expect(button).toBeTruthy()
  })

  it('announces a plural count exactly once', () => {
    const { getByRole } = renderHeader(3)
    const button = getByRole('button', { name: /^Cart 3 items$/ })
    expect(button).toBeTruthy()
  })
})
