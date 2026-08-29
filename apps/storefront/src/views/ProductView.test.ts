/**
 * This view renders its description through `RichText`, which calls
 * `sanitizeProductHtml`. That function refuses to run under happy-dom — the
 * storefront suite's default environment — because happy-dom's DOMPurify
 * support is a silent no-op (see `packages/sdk-commerce/src/sanitize.ts`).
 * jsdom is required here for the same reason `RichText.test.ts` needs it.
 *
 * @vitest-environment jsdom
 */
import type { ProductDetail, StorefrontClient, StorefrontResult } from '@sentra/sdk-commerce'
import { STOREFRONT_INJECTION_KEY } from '@sentra/sdk-commerce/vue'
import { ANALYTICS_INJECTION_KEY, type AnalyticsClient } from '@sentra/plugin-analytics'
import { TOAST_INJECTION_KEY, createToastService } from '@sentra/ui'
import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setStorefrontClient } from '../storefront.ts'
import ProductView from './ProductView.vue'

const PRODUCT: ProductDetail = {
  id: 'gid://shopify/Product/1',
  handle: 'sentra-piece-1',
  title: 'Stoneware Mug No. 1',
  availableForSale: true,
  price: { amount: '19.00', currencyCode: 'USD' },
  image: { url: 'https://cdn.shopify.com/mug.jpg', altText: 'A mug', width: 1200, height: 1200 },
  descriptionHtml:
    '<p>Thrown by hand.</p><script>window.pwned = true</script>' as ProductDetail['descriptionHtml'],
  variants: [
    {
      id: 'gid://shopify/ProductVariant/1-0',
      title: 'Speckled',
      availableForSale: true,
      price: { amount: '19.00', currencyCode: 'USD' },
    },
  ],
}

/** Records analytics without a real transport. */
function recordingAnalytics(): AnalyticsClient & { calls: [string, unknown][] } {
  const calls: [string, unknown][] = []
  return { calls, track: (name, props) => calls.push([name, props]), flush: () => {} }
}

function renderView(
  getProduct: () => Promise<StorefrontResult<ProductDetail | null>>,
  client: Partial<StorefrontClient> = {},
  analytics = recordingAnalytics(),
) {
  setStorefrontClient({ getProduct, ...client } as StorefrontClient)
  const utils = render(ProductView, {
    props: { handle: 'sentra-piece-1' },
    global: {
      provide: {
        [STOREFRONT_INJECTION_KEY as unknown as string]: { getProduct, ...client },
        [ANALYTICS_INJECTION_KEY as unknown as string]: analytics,
        [TOAST_INJECTION_KEY as unknown as string]: createToastService(),
      },
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
  return { ...utils, analytics }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('ProductView', () => {
  it('shows a loading state first', () => {
    const { getByTestId } = renderView(() => new Promise(() => {}))
    expect(getByTestId('state-loading')).toBeTruthy()
  })

  it('renders the title, formatted price, and description', async () => {
    const { findByText, getByTestId } = renderView(async () => ({ ok: true, value: PRODUCT }))
    expect(await findByText('Stoneware Mug No. 1')).toBeTruthy()
    expect(getByTestId('money').textContent).toContain('19')
    expect(getByTestId('rich-text').textContent).toContain('Thrown by hand')
  })

  it('never renders a script from the description', async () => {
    const { findByTestId, container } = renderView(async () => ({ ok: true, value: PRODUCT }))
    await findByTestId('rich-text')
    expect(container.querySelector('script')).toBeNull()
  })

  it('shows a not-found state for an unknown handle', async () => {
    const { findByTestId } = renderView(async () => ({ ok: true, value: null }))
    expect(await findByTestId('state-empty')).toBeTruthy()
  })

  it('shows an error state when the load fails', async () => {
    const { findByTestId } = renderView(async () => ({
      ok: false,
      error: { kind: 'network', message: 'down', attempts: 3, status: null },
    }))
    expect(await findByTestId('state-error')).toBeTruthy()
  })

  it('tracks product_view once the product is loaded', async () => {
    const { findByText, analytics } = renderView(async () => ({ ok: true, value: PRODUCT }))
    await findByText('Stoneware Mug No. 1')
    expect(analytics.calls).toContainEqual([
      'product_view',
      { handle: 'sentra-piece-1', available: true },
    ])
  })

  it('adds the selected variant to the cart and tracks it', async () => {
    const createCart = vi.fn(async () => ({
      ok: true as const,
      value: {
        id: 'gid://shopify/Cart/abc',
        checkoutUrl: 'https://demo-shop.myshopify.com/cart/c/abc',
        totalQuantity: 1,
        subtotal: { amount: '19.00', currencyCode: 'USD' as const },
        lines: [],
      },
    }))
    const { findByRole, analytics } = renderView(async () => ({ ok: true, value: PRODUCT }), {
      createCart,
    } as Partial<StorefrontClient>)

    const button = await findByRole('button', { name: /add to cart/i })
    button.click()
    await vi.waitFor(() => expect(createCart).toHaveBeenCalled())
    expect(createCart).toHaveBeenCalledWith({
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1-0', quantity: 1 }],
    })
    await vi.waitFor(() =>
      expect(analytics.calls).toContainEqual([
        'add_to_cart',
        {
          merchandiseId: 'gid://shopify/ProductVariant/1-0',
          quantity: 1,
          currency: 'USD',
          value: 19,
        },
      ]),
    )
  })

  it('disables adding when the product is sold out', async () => {
    const soldOut: ProductDetail = {
      ...PRODUCT,
      availableForSale: false,
      variants: [{ ...PRODUCT.variants[0]!, availableForSale: false }],
    }
    const { findByRole } = renderView(async () => ({ ok: true, value: soldOut }))
    const button = await findByRole('button', { name: /sold out/i })
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('offers a variant selector only when there is more than one variant', async () => {
    const { findByText, queryByLabelText } = renderView(async () => ({ ok: true, value: PRODUCT }))
    await findByText('Stoneware Mug No. 1')
    expect(queryByLabelText('Variant')).toBeNull()
  })

  it('renders a variant selector for a multi-variant product', async () => {
    const multi: ProductDetail = {
      ...PRODUCT,
      variants: [
        PRODUCT.variants[0]!,
        {
          id: 'gid://shopify/ProductVariant/1-1',
          title: 'Matte',
          availableForSale: true,
          price: { amount: '24.00', currencyCode: 'USD' },
        },
      ],
    }
    const { findByLabelText } = renderView(async () => ({ ok: true, value: multi }))
    expect(await findByLabelText('Variant')).toBeTruthy()
  })

  it('shows an inline failure alert without hiding the already-loaded product', async () => {
    /*
     * `useProduct` re-fetches when its `handle` source changes (`watch: () =>
     * toValue(handle)` in `useStorefrontQuery`). There is no in-app
     * product-to-product navigation today (parked for M4), so a prop rerender
     * is the only way to reach a second `getProduct` call from this test —
     * matching how `useStorefrontQuery` itself is actually driven.
     */
    const getProduct = vi
      .fn<StorefrontClient['getProduct']>()
      .mockResolvedValueOnce({ ok: true, value: PRODUCT })
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: 'network', message: 'down', attempts: 3, status: null },
      })
    setStorefrontClient({ getProduct } as unknown as StorefrontClient)
    const { findByText, findByRole, rerender } = render(ProductView, {
      props: { handle: 'sentra-piece-1' },
      global: {
        provide: {
          [STOREFRONT_INJECTION_KEY as unknown as string]: { getProduct },
          [ANALYTICS_INJECTION_KEY as unknown as string]: recordingAnalytics(),
          [TOAST_INJECTION_KEY as unknown as string]: createToastService(),
        },
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await findByText('Stoneware Mug No. 1')

    await rerender({ handle: 'sentra-piece-2' })

    const alert = await findByRole('alert')
    expect(alert.textContent).toMatch(/check your connection/i)
    // The previously loaded product's title stays visible — the failure is inline, not blocking.
    expect(await findByText('Stoneware Mug No. 1')).toBeTruthy()
  })
})
