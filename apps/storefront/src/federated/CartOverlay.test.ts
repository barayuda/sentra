import type { Cart, StorefrontClient } from '@sentra/sdk-commerce'
import { ANALYTICS_INJECTION_KEY, type AnalyticsClient } from '@sentra/plugin-analytics'
import { createShellBus, shellBusPlugin } from '@sentra/shell-contract'
import { toastPlugin } from '@sentra/ui'
import { DOMWrapper, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setStorefrontClient } from '../storefront.ts'
import { useCartStore } from '../stores/cart.ts'
import CartOverlay from './CartOverlay.vue'

/*
 * `@pinia/testing` is not a devDependency of this package. The neighbouring
 * component tests (e.g. `CartDrawer.test.ts`) rely on `setActivePinia` plus a
 * plain `createPinia()` instead, so this file matches that harness rather
 * than adding a dependency for one test file.
 */
beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  setStorefrontClient(null)
})

/**
 * A no-op analytics client, matching `CartDrawer.test.ts`'s
 * `recordingAnalytics()` shape. `CartDrawer` (rendered inside the overlay)
 * calls `useAnalytics()` unconditionally, so mounting the overlay in
 * isolation needs one provided even though most cases here make no assertion
 * on tracked events.
 */
function stubAnalytics(): AnalyticsClient {
  return { track: () => {}, flush: () => {} }
}

/** Same shape as `stubAnalytics()`, but records every call for assertion. */
function recordingAnalytics(): AnalyticsClient & { calls: [string, unknown][] } {
  const calls: [string, unknown][] = []
  return { calls, track: (name, props) => calls.push([name, props]), flush: () => {} }
}

/** Mounts the overlay with the bus plus the other plugins `CartDrawer` needs. */
function mountOverlay(
  bus: ReturnType<typeof createShellBus>,
  analytics: AnalyticsClient = stubAnalytics(),
) {
  return mount(CartOverlay, {
    global: {
      plugins: [[shellBusPlugin, bus], toastPlugin],
      provide: { [ANALYTICS_INJECTION_KEY as unknown as string]: analytics },
    },
  })
}

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

/** Seeds the active pinia's cart store with a cart of known `itemCount`, matching `CartDrawer.test.ts`'s `renderDrawer` pattern. */
async function seedCart(): Promise<void> {
  setStorefrontClient({
    getCart: vi.fn(async () => ({ ok: true as const, value: CART })),
  } as unknown as StorefrontClient)
  localStorage.setItem('sentra:cart-id', CART.id)
  await useCartStore().restore()
}

/*
 * `CartDrawer` renders `Dialog`, which teleports its content to
 * `document.body` (real, unstubbed Teleport) once mounted, so it never
 * appears under `wrapper.element`'s own subtree — `wrapper.find` cannot see
 * it. Querying `document.body` through a `DOMWrapper` is the fix; the
 * selector itself is exactly what the brief asked for, confirmed against
 * `Dialog.vue`'s template (`role="dialog"` on the panel).
 */
function findDialog(): ReturnType<DOMWrapper<Element>['find']> {
  return new DOMWrapper(document.body).find('[role="dialog"]')
}

describe('CartOverlay', () => {
  it('opens the drawer when the bus asks for it', async () => {
    const bus = createShellBus()
    const wrapper = mountOverlay(bus)
    expect(findDialog().exists()).toBe(false)

    bus.emit('cart:open-requested', { origin: 'test' })
    await wrapper.vm.$nextTick()

    expect(findDialog().exists()).toBe(true)
  })

  it('stops listening once unmounted', () => {
    const bus = createShellBus()
    const wrapper = mountOverlay(bus)
    wrapper.unmount()
    expect(() => bus.emit('cart:open-requested', { origin: 'test' })).not.toThrow()
  })

  it('tracks cart_open once with the cart current item count when asked to open', async () => {
    await seedCart()
    const bus = createShellBus()
    const analytics = recordingAnalytics()
    mountOverlay(bus, analytics)

    bus.emit('cart:open-requested', { origin: 'test' })

    expect(analytics.calls).toEqual([['cart_open', { itemCount: CART.totalQuantity }]])
  })
})
