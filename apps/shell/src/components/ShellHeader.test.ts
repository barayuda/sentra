import { createShellBus, shellBusPlugin } from '@sentra/shell-contract'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import ShellHeader from './ShellHeader.vue'

function renderHeader() {
  const bus = createShellBus()
  const utils = render(ShellHeader, {
    global: {
      plugins: [[shellBusPlugin, bus]],
      /* Stubbed rather than provided: this test is about the bus, and
         installing a router and a session plugin to render a header would
         mean a failure in either one reports as a header failure. */
      stubs: { RouterLink: { template: '<a><slot /></a>' }, RoleSwitcher: true },
    },
  })
  return { bus, ...utils }
}

describe('ShellHeader', () => {
  it('starts with an empty cart badge', () => {
    renderHeader()
    expect(screen.getByRole('button', { name: /cart, 0 items/i })).toBeTruthy()
  })

  it('updates the badge when a remote publishes cart:updated', async () => {
    const { bus } = renderHeader()
    bus.emit('cart:updated', { totalQuantity: 3 })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cart, 3 items/i })).toBeTruthy()
    })
  })

  it('asks the storefront to open the cart when clicked', async () => {
    const { bus } = renderHeader()
    const seen = vi.fn()
    bus.on('cart:open-requested', seen)

    screen.getByRole('button', { name: /cart/i }).click()

    await waitFor(() => {
      expect(seen).toHaveBeenCalledWith({ origin: 'shell-header' })
    })
  })
})
