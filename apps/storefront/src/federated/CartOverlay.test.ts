import type { Cart, StorefrontClient } from '@sentra/sdk-commerce'
import { ANALYTICS_INJECTION_KEY, type AnalyticsClient } from '@sentra/plugin-analytics'
import { createShellBus, type ShellBus, shellBusPlugin } from '@sentra/shell-contract'
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

/**
 * A real bus whose `on` hands back a spy in place of the real unsubscribe
 * function, so a test can observe whether the component actually called it —
 * the real unsubscribe still runs underneath, via `mockImplementation`, so
 * the bus keeps behaving exactly like `createShellBus()` otherwise.
 */
function busWithSpiedUnsubscribe(): { bus: ShellBus; unsubscribe: ReturnType<typeof vi.fn> } {
  const real = createShellBus()
  const unsubscribe = vi.fn()
  const bus: ShellBus = {
    emit: real.emit,
    on: (event, handler) => {
      unsubscribe.mockImplementation(real.on(event, handler))
      return unsubscribe
    },
  }
  return { bus, unsubscribe }
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

  /*
   * `ShellBus.emit()` swallows every handler error and never rethrows (see
   * `bus.ts`), and the handler here (`open.value = true`) cannot throw on an
   * unmounted component regardless of unsubscription — so "does not throw"
   * is not a claim this test can lose. These two assertions replace it with
   * ones that are actually tied to `onBeforeUnmount(stop)` existing: deleting
   * it must turn both red, which was confirmed by deliberately removing it
   * and observing the failures before restoring it.
   */
  it('invokes the bus unsubscribe function on unmount', () => {
    const { bus, unsubscribe } = busWithSpiedUnsubscribe()
    const wrapper = mountOverlay(bus)
    expect(unsubscribe).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('no longer reacts to the bus once unmounted', () => {
    const bus = createShellBus()
    const analytics = recordingAnalytics()
    const wrapper = mountOverlay(bus, analytics)

    bus.emit('cart:open-requested', { origin: 'test' })
    expect(analytics.calls).toHaveLength(1)

    wrapper.unmount()
    bus.emit('cart:open-requested', { origin: 'test' })

    expect(analytics.calls).toHaveLength(1)
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
