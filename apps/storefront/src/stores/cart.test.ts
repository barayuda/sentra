import type { Cart, StorefrontClient, StorefrontResult } from '@sentra/sdk-commerce'
import { createShellBus, shellBusPlugin } from '@sentra/shell-contract'
import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setStorefrontClient } from '../storefront.ts'
import { CART_ID_STORAGE_KEY, useCartStore } from './cart.ts'

function cart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: 'gid://shopify/Cart/abc',
    checkoutUrl: 'https://demo-shop.myshopify.com/cart/c/abc',
    totalQuantity: 2,
    subtotal: { amount: '38.00', currencyCode: 'USD' },
    lines: [
      {
        id: 'gid://shopify/CartLine/1',
        quantity: 2,
        merchandiseId: 'gid://shopify/ProductVariant/1-0',
        productTitle: 'Stoneware Mug',
        productHandle: 'sentra-piece-1',
        variantTitle: 'Default',
        price: { amount: '19.00', currencyCode: 'USD' },
        image: null,
      },
    ],
    ...overrides,
  }
}

const ok = <T>(value: T): StorefrontResult<T> => ({ ok: true, value })
const fail = <T>(): StorefrontResult<T> => ({
  ok: false,
  error: { kind: 'network', message: 'down', attempts: 3, status: null },
})

/** Installs a stub client and returns its spies. */
function stubClient(overrides: Partial<StorefrontClient> = {}) {
  const client = {
    createCart: vi.fn(async () => ok(cart())),
    getCart: vi.fn(async () => ok<Cart | null>(cart())),
    addCartLines: vi.fn(async () => ok(cart())),
    updateCartLines: vi.fn(async () => ok(cart())),
    removeCartLines: vi.fn(async () => ok(cart({ totalQuantity: 0, lines: [] }))),
    ...overrides,
  } as unknown as StorefrontClient
  setStorefrontClient(client)
  return client as unknown as Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

afterEach(() => {
  setStorefrontClient(null)
})

describe('restore', () => {
  it('does nothing when no cart id is stored', async () => {
    const client = stubClient()
    await useCartStore().restore()
    expect(client.getCart).not.toHaveBeenCalled()
  })

  it('loads the stored cart', async () => {
    localStorage.setItem(CART_ID_STORAGE_KEY, 'gid://shopify/Cart/abc')
    const client = stubClient()
    const store = useCartStore()
    await store.restore()
    expect(client.getCart).toHaveBeenCalledWith({ cartId: 'gid://shopify/Cart/abc' })
    expect(store.itemCount).toBe(2)
  })

  it('forgets a stale cart id rather than retrying it forever', async () => {
    /* Shopify carts expire; a stale id in storage must not poison every visit. */
    localStorage.setItem(CART_ID_STORAGE_KEY, 'gid://shopify/Cart/gone')
    stubClient({ getCart: vi.fn(async () => ok<Cart | null>(null)) as never })
    const store = useCartStore()
    await store.restore()
    expect(localStorage.getItem(CART_ID_STORAGE_KEY)).toBeNull()
    expect(store.cart).toBeNull()
  })

  it('keeps the id when the load fails for a transport reason', async () => {
    /* A network failure is not evidence the cart is gone. */
    localStorage.setItem(CART_ID_STORAGE_KEY, 'gid://shopify/Cart/abc')
    stubClient({ getCart: vi.fn(async () => fail<Cart | null>()) as never })
    const store = useCartStore()
    await store.restore()
    expect(localStorage.getItem(CART_ID_STORAGE_KEY)).toBe('gid://shopify/Cart/abc')
    expect(store.error?.kind).toBe('network')
  })

  it('discards a restore that resolves after a newer mutation has already written state', async () => {
    /* Same shape as `useCollection`'s "discards a superseded collection load"
       test (`packages/sdk-commerce/src/vue/queries.test.ts`): a manually
       controlled resolver lets the slower, EARLIER call resolve LAST, proving
       the generation guard — not call order — decides which write wins. */
    const resolvers: ((value: StorefrontResult<Cart | null>) => void)[] = []
    const getCart = vi.fn(
      () => new Promise<StorefrontResult<Cart | null>>((resolve) => resolvers.push(resolve)),
    )
    stubClient({ getCart: getCart as never })
    localStorage.setItem(CART_ID_STORAGE_KEY, 'gid://shopify/Cart/abc')
    const store = useCartStore()

    const restorePromise = store.restore()
    /* A newer, faster mutation completes and adopts its own cart before
       restore resolves. */
    await store.addLine('gid://shopify/ProductVariant/2-0')
    const cartAfterAdd = store.cart

    /* The stale restore() now resolves — it must NOT overwrite the newer
       state. */
    resolvers[0]?.(ok(cart()))
    await restorePromise

    expect(store.cart).toBe(cartAfterAdd)
  })
})

describe('addLine', () => {
  it('creates the cart with the line in one request when none exists', async () => {
    const client = stubClient()
    const store = useCartStore()
    const added = await store.addLine('gid://shopify/ProductVariant/1-0', 2)

    expect(added).toBe(true)
    expect(client.createCart).toHaveBeenCalledWith({
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1-0', quantity: 2 }],
    })
    /* One round trip, not create-then-add. */
    expect(client.addCartLines).not.toHaveBeenCalled()
    expect(store.itemCount).toBe(2)
  })

  it('persists the new cart id', async () => {
    stubClient()
    await useCartStore().addLine('gid://shopify/ProductVariant/1-0')
    expect(localStorage.getItem(CART_ID_STORAGE_KEY)).toBe('gid://shopify/Cart/abc')
  })

  it('adds to the existing cart on a second call', async () => {
    const client = stubClient()
    const store = useCartStore()
    await store.addLine('gid://shopify/ProductVariant/1-0')
    await store.addLine('gid://shopify/ProductVariant/2-0')
    expect(client.createCart).toHaveBeenCalledTimes(1)
    expect(client.addCartLines).toHaveBeenCalledWith({
      cartId: 'gid://shopify/Cart/abc',
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/2-0', quantity: 1 }],
    })
  })

  it('defaults the quantity to one', async () => {
    const client = stubClient()
    await useCartStore().addLine('gid://shopify/ProductVariant/1-0')
    expect(client.createCart).toHaveBeenCalledWith({
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1-0', quantity: 1 }],
    })
  })

  it('reports failure and records the error', async () => {
    stubClient({ createCart: vi.fn(async () => fail<Cart>()) as never })
    const store = useCartStore()
    expect(await store.addLine('v1')).toBe(false)
    expect(store.error?.kind).toBe('network')
    expect(store.cart).toBeNull()
  })

  it('clears a previous error after a success', async () => {
    const createCart = vi.fn().mockResolvedValueOnce(fail<Cart>()).mockResolvedValue(ok(cart()))
    stubClient({ createCart: createCart as never })
    const store = useCartStore()
    await store.addLine('v1')
    expect(store.error).not.toBeNull()
    await store.addLine('v1')
    expect(store.error).toBeNull()
  })
})

describe('line mutations', () => {
  it('updates a quantity', async () => {
    const client = stubClient()
    const store = useCartStore()
    await store.addLine('gid://shopify/ProductVariant/1-0')
    await store.setLineQuantity('gid://shopify/CartLine/1', 5)
    expect(client.updateCartLines).toHaveBeenCalledWith({
      cartId: 'gid://shopify/Cart/abc',
      lines: [{ id: 'gid://shopify/CartLine/1', quantity: 5 }],
    })
  })

  it('removes the line when the quantity reaches zero', async () => {
    /* Sending quantity 0 works on Shopify, but routing it through remove keeps
       one meaning per call and makes the analytics event unambiguous. */
    const client = stubClient()
    const store = useCartStore()
    await store.addLine('gid://shopify/ProductVariant/1-0')
    await store.setLineQuantity('gid://shopify/CartLine/1', 0)
    expect(client.removeCartLines).toHaveBeenCalledWith({
      cartId: 'gid://shopify/Cart/abc',
      lineIds: ['gid://shopify/CartLine/1'],
    })
    expect(client.updateCartLines).not.toHaveBeenCalled()
  })

  it('removes a line', async () => {
    const client = stubClient()
    const store = useCartStore()
    await store.addLine('gid://shopify/ProductVariant/1-0')
    expect(await store.removeLine('gid://shopify/CartLine/1')).toBe(true)
    expect(client.removeCartLines).toHaveBeenCalled()
    expect(store.isEmpty).toBe(true)
  })

  it('refuses a mutation with no cart', async () => {
    const client = stubClient()
    const store = useCartStore()
    expect(await store.setLineQuantity('l1', 2)).toBe(false)
    expect(client.updateCartLines).not.toHaveBeenCalled()
  })
})

describe('derived state', () => {
  it('exposes lines, subtotal, and checkout url', async () => {
    stubClient()
    const store = useCartStore()
    await store.addLine('gid://shopify/ProductVariant/1-0')
    expect(store.lines).toHaveLength(1)
    expect(store.subtotal?.amount).toBe('38.00')
    expect(store.checkoutUrl).toContain('/cart/c/abc')
  })

  it('reports empty before anything is loaded', () => {
    stubClient()
    const store = useCartStore()
    expect(store.isEmpty).toBe(true)
    expect(store.itemCount).toBe(0)
    expect(store.subtotal).toBeNull()
  })

  it('stays loading until every concurrent operation settles', async () => {
    /* A counter, not a boolean: two overlapping mutations must not have the
       first one's completion switch the spinner off under the second. */
    const resolvers: (() => void)[] = []
    stubClient({
      createCart: vi.fn(
        () => new Promise((resolve) => resolvers.push(() => resolve(ok(cart())))),
      ) as never,
      addCartLines: vi.fn(
        () => new Promise((resolve) => resolvers.push(() => resolve(ok(cart())))),
      ) as never,
    })
    const store = useCartStore()
    const first = store.addLine('v1')
    const second = store.addLine('v2')
    expect(store.loading).toBe(true)
    resolvers[0]?.()
    await first
    expect(store.loading).toBe(true)
    resolvers[1]?.()
    await second
    expect(store.loading).toBe(false)
  })

  it('forgets the cart and its stored id', async () => {
    stubClient()
    const store = useCartStore()
    await store.addLine('gid://shopify/ProductVariant/1-0')
    store.forget()
    expect(store.cart).toBeNull()
    expect(localStorage.getItem(CART_ID_STORAGE_KEY)).toBeNull()
  })

  it('publishes the line total to the bus after a successful add', async () => {
    stubClient()
    const bus = createShellBus()
    const seen: number[] = []
    bus.on('cart:updated', (payload) => seen.push(payload.totalQuantity))

    const app = createApp({})
    app.use(createPinia())
    app.use(shellBusPlugin, bus)
    const store = app.runWithContext(() => useCartStore())

    await store.addLine('gid://shopify/ProductVariant/1', 2)

    expect(seen.at(-1)).toBe(store.itemCount)
  })

  it('does not throw when no bus is installed', async () => {
    stubClient()
    const store = useCartStore()
    await expect(store.addLine('gid://shopify/ProductVariant/1', 1)).resolves.not.toThrow()
  })
})
