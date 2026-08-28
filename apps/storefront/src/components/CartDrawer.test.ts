import type { Cart, StorefrontClient } from '@sentra/sdk-commerce'
import { ANALYTICS_INJECTION_KEY, type AnalyticsClient } from '@sentra/plugin-analytics'
import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setStorefrontClient } from '../storefront.ts'
import { useCartStore } from '../stores/cart.ts'
import CartDrawer from './CartDrawer.vue'

const CART: Cart = {
  id: 'gid://shopify/Cart/abc',
  checkoutUrl: 'https://demo-shop.myshopify.com/cart/c/abc',
  totalQuantity: 2,
  subtotal: { amount: '38.00', currencyCode: 'USD' },
  lines: [
    {
      id: 'gid://shopify/CartLine/1',
      quantity: 2,
      merchandiseId: 'gid://shopify/ProductVariant/1-0',
      productTitle: 'Stoneware Mug No. 1',
      productHandle: 'sentra-piece-1',
      variantTitle: 'Speckled',
      price: { amount: '19.00', currencyCode: 'USD' },
      image: { url: 'https://cdn.shopify.com/mug.jpg', altText: 'A mug', width: 800, height: 800 },
    },
  ],
}

function recordingAnalytics(): AnalyticsClient & { calls: [string, unknown][] } {
  const calls: [string, unknown][] = []
  return { calls, track: (name, props) => calls.push([name, props]), flush: () => {} }
}

/** Renders the drawer open, with the store pre-populated. */
async function renderDrawer(client: Partial<StorefrontClient> = {}) {
  const analytics = recordingAnalytics()
  const stub = {
    getCart: vi.fn(async () => ({ ok: true as const, value: CART })),
    updateCartLines: vi.fn(async () => ({ ok: true as const, value: CART })),
    removeCartLines: vi.fn(async () => ({
      ok: true as const,
      value: { ...CART, totalQuantity: 0, lines: [] },
    })),
    ...client,
  } as unknown as StorefrontClient
  setStorefrontClient(stub)

  localStorage.setItem('sentra:cart-id', CART.id)
  const store = useCartStore()
  await store.restore()

  const utils = render(CartDrawer, {
    props: { modelValue: true },
    global: {
      provide: { [ANALYTICS_INJECTION_KEY as unknown as string]: analytics },
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
  return { ...utils, analytics, stub: stub as unknown as Record<string, ReturnType<typeof vi.fn>> }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('CartDrawer', () => {
  it('renders each line with its product title and price', async () => {
    const { findByText, getAllByTestId } = await renderDrawer()
    expect(await findByText('Stoneware Mug No. 1')).toBeTruthy()
    expect(getAllByTestId('money').length).toBeGreaterThan(0)
  })

  it('shows the subtotal', async () => {
    const { findByTestId } = await renderDrawer()
    expect((await findByTestId('cart-subtotal')).textContent).toContain('38')
  })

  it('increases a line quantity', async () => {
    const { findByRole, stub } = await renderDrawer()
    const increase = await findByRole('button', { name: /increase quantity/i })
    increase.click()
    await vi.waitFor(() =>
      expect(stub.updateCartLines).toHaveBeenCalledWith({
        cartId: CART.id,
        lines: [{ id: 'gid://shopify/CartLine/1', quantity: 3 }],
      }),
    )
  })

  it('decreases a line quantity', async () => {
    const { findByRole, stub } = await renderDrawer()
    const decrease = await findByRole('button', { name: /decrease quantity/i })
    decrease.click()
    await vi.waitFor(() =>
      expect(stub.updateCartLines).toHaveBeenCalledWith({
        cartId: CART.id,
        lines: [{ id: 'gid://shopify/CartLine/1', quantity: 1 }],
      }),
    )
  })

  it('removes a line and tracks it', async () => {
    const { findByRole, stub, analytics } = await renderDrawer()
    const remove = await findByRole('button', { name: /remove stoneware mug/i })
    remove.click()
    await vi.waitFor(() => expect(stub.removeCartLines).toHaveBeenCalled())
    /*
     * Adapted from a bare `expect` (Ruling 6): `stub.removeCartLines` is
     * called synchronously (before the first `await` inside the store), so
     * the `vi.waitFor` above can resolve before `remove`'s own `await
     * cart.removeLine(...)` unwinds far enough to reach the `analytics.track`
     * call that follows it. Polling this assertion the same way the mock call
     * is polled removes that race; the assertion content is unchanged.
     */
    await vi.waitFor(() =>
      expect(analytics.calls).toContainEqual([
        'remove_from_cart',
        { lineId: 'gid://shopify/CartLine/1', quantity: 2 },
      ]),
    )
  })

  it('shows an empty state when the cart has no lines', async () => {
    setActivePinia(createPinia())
    setStorefrontClient({} as StorefrontClient)
    const { findByTestId } = render(CartDrawer, {
      props: { modelValue: true },
      global: {
        provide: { [ANALYTICS_INJECTION_KEY as unknown as string]: recordingAnalytics() },
      },
    })
    /*
     * Adapted from a synchronous `getByTestId` (Ruling 6): `Dialog` defers its
     * Teleport behind an `onMounted` flag, so its content — including this
     * empty state — is not yet in the DOM the instant `render()` returns.
     * `findByTestId` retries until the post-mount patch lands; the assertion
     * itself (`toBeTruthy()` on the found element) is unchanged.
     */
    expect(await findByTestId('cart-empty')).toBeTruthy()
  })

  it('links to the Shopify-hosted checkout', async () => {
    const { findByRole } = await renderDrawer()
    const checkout = await findByRole('link', { name: /checkout/i })
    expect(checkout.getAttribute('href')).toBe(CART.checkoutUrl)
    expect(checkout.getAttribute('rel')).toContain('noopener')
  })

  /**
   * `Dialog` has no close button of its own (confirmed by reading
   * `packages/ui/src/components/Dialog/Dialog.vue`'s template) — it closes
   * only via Escape or a click on its overlay backdrop
   * (`data-testid="dialog-overlay"`). `CartDrawer` adds no close affordance
   * either, relying entirely on `Dialog`'s own dismissal mechanisms, so this
   * test exercises the overlay rather than a nonexistent "close" button.
   */
  it('closes when the dialog asks to close', async () => {
    const { emitted, findByTestId } = await renderDrawer()
    const overlay = await findByTestId('dialog-overlay')
    overlay.click()
    await vi.waitFor(() => expect(emitted()['update:modelValue']).toBeTruthy())
  })

  it('shows a failure message without discarding the cart', async () => {
    const { findByRole, findByText } = await renderDrawer({
      updateCartLines: vi.fn(async () => ({
        ok: false as const,
        error: { kind: 'network' as const, message: 'down', attempts: 3, status: null },
      })),
    } as Partial<StorefrontClient>)
    const increase = await findByRole('button', { name: /increase quantity/i })
    increase.click()
    /*
     * Asserts on `errorCopy`'s `.detail` text, not `.title`: `CartDrawer`'s
     * failure banner is a non-blocking inline alert (the lines stay
     * rendered, nothing is discarded), matching `CollectionView.vue`'s
     * `inlineError` shape — `role="alert"` with `copy.detail` alone, no
     * title. That is the app's one coherent inline-error pattern.
     */
    expect(await findByText(/check your connection/i)).toBeTruthy()
    expect(await findByText('Stoneware Mug No. 1')).toBeTruthy()
  })
})
