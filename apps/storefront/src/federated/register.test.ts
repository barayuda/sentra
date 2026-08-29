import type { Cart, StorefrontClient } from '@sentra/sdk-commerce'
import { createShellBus, shellBusPlugin } from '@sentra/shell-contract'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CART_ID_STORAGE_KEY, useCartStore } from '../stores/cart.ts'
import { setStorefrontClient } from '../storefront.ts'
import { registerStorefront } from './register.ts'

afterEach(() => {
  setStorefrontClient(null)
  localStorage.clear()
})

const CART: Cart = {
  id: 'gid://shopify/Cart/abc',
  checkoutUrl: 'https://demo-shop.myshopify.com/cart/c/abc',
  totalQuantity: 3,
  subtotal: { amount: '57.00', currencyCode: 'USD' },
  lines: [
    {
      id: 'gid://shopify/CartLine/1',
      quantity: 3,
      merchandiseId: 'gid://shopify/ProductVariant/1-0',
      productTitle: 'Stoneware Mug',
      productHandle: 'sentra-piece-1',
      variantTitle: 'Default',
      price: { amount: '19.00', currencyCode: 'USD' },
      image: null,
    },
  ],
}

/**
 * Builds a host-shaped app the same way `main.ts` does — Pinia and the bus
 * installed before `register` runs — so these tests exercise the exact
 * ordering a real host (standalone or a shell) uses, not a shortcut.
 */
function buildHost(): {
  app: ReturnType<typeof createApp>
  bus: ReturnType<typeof createShellBus>
} {
  const app = createApp({})
  const bus = createShellBus()
  app.use(createPinia())
  app.use(shellBusPlugin, bus)
  return { app, bus }
}

describe('registerStorefront', () => {
  it('restores a persisted cart on registration', async () => {
    setStorefrontClient({
      getCart: vi.fn(async () => ({ ok: true as const, value: CART })),
    } as unknown as StorefrontClient)
    localStorage.setItem(CART_ID_STORAGE_KEY, CART.id)

    const { app, bus } = buildHost()
    registerStorefront(app, { bus, basePath: '' })
    await flushPromises()

    const store = app.runWithContext(() => useCartStore())
    expect(store.itemCount).toBe(CART.totalQuantity)
  })

  it('forgets the cart when the session changes', async () => {
    setStorefrontClient({
      getCart: vi.fn(async () => ({ ok: true as const, value: CART })),
    } as unknown as StorefrontClient)
    localStorage.setItem(CART_ID_STORAGE_KEY, CART.id)

    const { app, bus } = buildHost()
    registerStorefront(app, { bus, basePath: '' })
    await flushPromises()

    const store = app.runWithContext(() => useCartStore())
    expect(store.itemCount).toBe(CART.totalQuantity)

    bus.emit('session:changed', { session: null })

    expect(store.cart).toBeNull()
    expect(localStorage.getItem(CART_ID_STORAGE_KEY)).toBeNull()
  })
})
