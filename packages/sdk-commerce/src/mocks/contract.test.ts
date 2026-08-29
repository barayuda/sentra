import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createStorefrontClient } from '../client.ts'
import type { StorefrontError, StorefrontResult, RequestCost } from '../errors.ts'
import {
  MOCK_SHOP_DOMAIN,
  MOCK_STOREFRONT_TOKEN,
  createMockControl,
  createStorefrontHandlers,
  resetMockStore,
} from './index.ts'

/**
 * Asserts the result is a failure and returns its error.
 *
 * A bare `if (!result.ok)` guard silently passes when the result is a success —
 * the assertions inside never run — so a regression would look identical to a
 * fix. This throws instead, which is what makes these tests able to fail.
 */
function expectFailure(result: StorefrontResult<unknown>): StorefrontError {
  if (result.ok) {
    throw new Error(`expected a failure, received ok(${JSON.stringify(result.value)})`)
  }
  return result.error
}

const control = createMockControl()
const server = setupServer(...createStorefrontHandlers(control))

const costs: RequestCost[] = []

/** A client pointed at the mocked endpoint, with retries that do not wait. */
function client() {
  return createStorefrontClient({
    domain: MOCK_SHOP_DOMAIN,
    token: MOCK_STOREFRONT_TOKEN,
    sleep: async () => {},
    onCost: (cost) => costs.push(cost),
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockStore()
  control.scenario = 'ok'
  control.latencyMs = 0
  costs.length = 0
})
afterAll(() => server.close())

describe('collection listing', () => {
  it('returns the first page with a cursor', async () => {
    const result = await client().getCollection({ handle: 'tableware', first: 8 })
    if (!result.ok) throw new Error('expected success')
    expect(result.value.products).toHaveLength(8)
    expect(result.value.hasNextPage).toBe(true)
    expect(result.value.endCursor).not.toBeNull()
  })

  it('walks every page to exhaustion without repeating a product', async () => {
    const sdk = client()
    const seen: string[] = []
    let after: string | null = null
    let guard = 0
    do {
      const page = await sdk.getCollection({ handle: 'tableware', first: 8, after })
      if (!page.ok) throw new Error('pagination failed')
      seen.push(...page.value.products.map((product) => product.id))
      after = page.value.hasNextPage ? page.value.endCursor : null
      guard += 1
    } while (after !== null && guard < 10)

    expect(seen).toHaveLength(24)
    expect(new Set(seen).size).toBe(24)
  })

  it('reports the query cost so the budget is observable', async () => {
    await client().getCollection({ handle: 'tableware', first: 8 })
    expect(costs).toHaveLength(1)
    expect(costs[0]?.requestedQueryCost).toBeGreaterThan(0)
    expect(costs[0]?.throttleStatus?.restoreRate).toBeGreaterThan(0)
  })
})

describe('product detail', () => {
  it('returns a product by handle', async () => {
    const result = await client().getProduct({ handle: 'sentra-piece-1' })
    if (!result.ok || !result.value) throw new Error('expected a product')
    expect(result.value.handle).toBe('sentra-piece-1')
    expect(result.value.variants.length).toBeGreaterThan(0)
  })

  it('returns null for an unknown handle', async () => {
    const result = await client().getProduct({ handle: 'does-not-exist' })
    expect(result).toEqual({ ok: true, value: null })
  })

  it('serves a description containing a script payload, unsanitised', async () => {
    /* The fixture is hostile on purpose: it is what proves the sanitiser in the
       application layer is load-bearing rather than decorative. */
    const result = await client().getProduct({ handle: 'sentra-piece-1' })
    if (!result.ok || !result.value) throw new Error('expected a product')
    expect(result.value.descriptionHtml).toContain('<script>')
  })
})

describe('cart lifecycle', () => {
  it('creates, adds, updates, and removes across requests', async () => {
    const sdk = client()

    const created = await sdk.createCart({})
    if (!created.ok) throw new Error('create failed')
    expect(created.value.totalQuantity).toBe(0)
    expect(created.value.checkoutUrl).toContain(MOCK_SHOP_DOMAIN)

    const added = await sdk.addCartLines({
      cartId: created.value.id,
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1-0', quantity: 2 }],
    })
    if (!added.ok) throw new Error('add failed')
    expect(added.value.totalQuantity).toBe(2)
    expect(added.value.lines).toHaveLength(1)
    /* priceFor(offset=0) = 19.00 for sentra-piece-1's variant; 2 units = 38.00. */
    expect(added.value.subtotal.amount).toBe('38.00')

    const lineId = added.value.lines[0]?.id ?? ''
    const updated = await sdk.updateCartLines({
      cartId: created.value.id,
      lines: [{ id: lineId, quantity: 5 }],
    })
    if (!updated.ok) throw new Error('update failed')
    expect(updated.value.totalQuantity).toBe(5)
    /* 5 units at 19.00 = 95.00. */
    expect(updated.value.subtotal.amount).toBe('95.00')

    const removed = await sdk.removeCartLines({ cartId: created.value.id, lineIds: [lineId] })
    if (!removed.ok) throw new Error('remove failed')
    expect(removed.value.lines).toEqual([])
    expect(removed.value.totalQuantity).toBe(0)
  })

  it('merges a repeated variant into the existing line', async () => {
    const sdk = client()
    const created = await sdk.createCart({})
    if (!created.ok) throw new Error('create failed')
    const line = { merchandiseId: 'gid://shopify/ProductVariant/1-0', quantity: 1 }
    await sdk.addCartLines({ cartId: created.value.id, lines: [line] })
    const second = await sdk.addCartLines({ cartId: created.value.id, lines: [line] })
    if (!second.ok) throw new Error('add failed')
    expect(second.value.lines).toHaveLength(1)
    expect(second.value.lines[0]?.quantity).toBe(2)
  })

  it('reads a cart back by id', async () => {
    const sdk = client()
    const created = await sdk.createCart({
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/2-0', quantity: 1 }],
    })
    if (!created.ok) throw new Error('create failed')
    const fetched = await sdk.getCart({ cartId: created.value.id })
    if (!fetched.ok || !fetched.value) throw new Error('expected a cart')
    expect(fetched.value.lines).toHaveLength(1)
  })

  it('returns null for an unknown cart id', async () => {
    const result = await client().getCart({ cartId: 'gid://shopify/Cart/nope' })
    expect(result).toEqual({ ok: true, value: null })
  })

  it('keeps quantity, lines and subtotal consistent when a variant does not resolve', async () => {
    /**
     * A cart line pointing at an unknown variant is dropped from the line list.
     * The item count and subtotal must drop it too — a cart reporting a nonzero
     * quantity with no lines would surface downstream as a header badge above an
     * empty drawer.
     */
    const created = await client().createCart({
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/does-not-exist', quantity: 3 }],
    })
    if (!created.ok) throw new Error('create failed')
    expect(created.value.lines).toEqual([])
    expect(created.value.totalQuantity).toBe(0)
    expect(created.value.subtotal.amount).toBe('0.00')
  })
})

describe('failure scenarios', () => {
  it('produces a throttled error with the budget attached', async () => {
    control.scenario = 'throttled'
    const result = await client().getCollection({ handle: 'tableware', first: 8 })
    const error = expectFailure(result)
    expect(error).toMatchObject({
      kind: 'throttled',
      attempts: 3,
      throttleStatus: { currentlyAvailable: 0 },
    })
  })

  it('produces a network error when the request cannot complete', async () => {
    control.scenario = 'network'
    const result = await client().getCollection({ handle: 'tableware', first: 8 })
    expect(expectFailure(result)).toMatchObject({ kind: 'network' })
  })

  it('produces a graphql_user error from a rejected cart mutation', async () => {
    control.scenario = 'user_error'
    const sdk = client()
    control.scenario = 'ok'
    const created = await sdk.createCart({})
    if (!created.ok) throw new Error('create failed')
    control.scenario = 'user_error'
    const result = await sdk.addCartLines({
      cartId: created.value.id,
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1-0', quantity: 1 }],
    })
    const error = expectFailure(result)
    expect(error).toMatchObject({ kind: 'graphql_user', userErrors: [{}] })
  })

  it('produces a schema error when the response drops a required field', async () => {
    control.scenario = 'schema_drift'
    const result = await client().getProduct({ handle: 'sentra-piece-1' })
    const error = expectFailure(result)
    expect(error).toMatchObject({ kind: 'schema', path: '$.product.title' })
  })
})
