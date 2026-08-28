import { describe, expect, it } from 'vitest'
import type { StorefrontError, StorefrontResult } from '../errors.ts'
import type { StorefrontTransport } from '../transport.ts'
import { addCartLines, createCart, getCart, removeCartLines, updateCartLines } from './cart.ts'

/**
 * Asserts the result is a failure and returns its error.
 *
 * A bare `if (!result.ok)` guard silently passes when the result is a success —
 * the assertions inside never run — so a regression would look identical to a fix.
 */
function expectFailure(result: StorefrontResult<unknown>): StorefrontError {
  if (result.ok) {
    throw new Error(`expected a failure, received ok(${JSON.stringify(result.value)})`)
  }
  return result.error
}

const WIRE_CART = {
  id: 'gid://shopify/Cart/abc',
  checkoutUrl: 'https://demo-shop.myshopify.com/cart/c/abc',
  totalQuantity: 3,
  cost: { subtotalAmount: { amount: '87.00', currencyCode: 'USD' } },
  lines: {
    edges: [
      {
        node: {
          id: 'gid://shopify/CartLine/1',
          quantity: 3,
          merchandise: {
            id: 'gid://shopify/ProductVariant/11',
            title: 'Speckled',
            price: { amount: '29.00', currencyCode: 'USD' },
            image: {
              url: 'https://cdn.shopify.com/mug.jpg',
              altText: null,
              width: 800,
              height: 800,
            },
            product: { title: 'Stoneware Mug', handle: 'stoneware-mug' },
          },
        },
      },
    ],
  },
}

/** A transport returning one canned payload, recording what it was sent. */
function stubTransport(value: unknown): StorefrontTransport & { sent: unknown[] } {
  const sent: unknown[] = []
  return {
    sent,
    async request<TData>(document: string, variables?: Record<string, unknown>) {
      sent.push({ operation: /(?:query|mutation)\s+(\w+)/.exec(document)?.[1], variables })
      return { ok: true, value: value as TData } as const
    },
  }
}

describe('createCart', () => {
  it('maps the created cart into the domain shape', async () => {
    const transport = stubTransport({ cartCreate: { cart: WIRE_CART, userErrors: [] } })
    const result = await createCart(transport, {
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/11', quantity: 3 }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).toBe('gid://shopify/Cart/abc')
    expect(result.value.totalQuantity).toBe(3)
    expect(result.value.subtotal).toEqual({ amount: '87.00', currencyCode: 'USD' })
    expect(result.value.lines).toHaveLength(1)
    expect(result.value.lines[0]).toMatchObject({
      id: 'gid://shopify/CartLine/1',
      quantity: 3,
      merchandiseId: 'gid://shopify/ProductVariant/11',
      productTitle: 'Stoneware Mug',
      productHandle: 'stoneware-mug',
      variantTitle: 'Speckled',
    })
  })

  it('sends the lines as mutation variables', async () => {
    const transport = stubTransport({ cartCreate: { cart: WIRE_CART, userErrors: [] } })
    const lines = [{ merchandiseId: 'gid://shopify/ProductVariant/11', quantity: 1 }]
    await createCart(transport, { lines })
    expect(transport.sent).toEqual([{ operation: 'CartCreate', variables: { lines } }])
  })

  it('creates an empty cart when no lines are given', async () => {
    const transport = stubTransport({ cartCreate: { cart: WIRE_CART, userErrors: [] } })
    await createCart(transport, {})
    expect(transport.sent).toEqual([{ operation: 'CartCreate', variables: { lines: [] } }])
  })
})

describe('userErrors handling', () => {
  it('reports a rejected line as a graphql_user error, not a success', async () => {
    const transport = stubTransport({
      cartLinesAdd: {
        cart: WIRE_CART,
        userErrors: [
          {
            field: ['lines', '0', 'quantity'],
            message: 'Quantity must be positive',
            code: 'INVALID',
          },
        ],
      },
    })
    const result = await addCartLines(transport, {
      cartId: 'gid://shopify/Cart/abc',
      lines: [{ merchandiseId: 'v1', quantity: 0 }],
    })

    expect(expectFailure(result)).toMatchObject({
      kind: 'graphql_user',
      message: 'Quantity must be positive',
      userErrors: [{ field: ['lines', '0', 'quantity'] }],
    })
  })

  it('prefers userErrors over the returned cart even when both are present', async () => {
    /* Shopify returns HTTP 200 with the *unchanged* cart plus userErrors. A
       client that reads `cart` first reports success and loses the rejection. */
    const transport = stubTransport({
      cartLinesRemove: {
        cart: WIRE_CART,
        userErrors: [{ field: null, message: 'Line does not exist', code: 'INVALID' }],
      },
    })
    const result = await removeCartLines(transport, { cartId: 'c', lineIds: ['missing'] })
    expect(expectFailure(result)).toMatchObject({
      kind: 'graphql_user',
      message: 'Line does not exist',
    })
  })

  it('treats a null cart with no userErrors as a schema error', async () => {
    const transport = stubTransport({ cartLinesUpdate: { cart: null, userErrors: [] } })
    const result = await updateCartLines(transport, {
      cartId: 'c',
      lines: [{ id: 'l1', quantity: 2 }],
    })
    expect(expectFailure(result)).toMatchObject({ kind: 'schema' })
  })
})

describe('mutation variables', () => {
  it('sends cartId and lines for add', async () => {
    const transport = stubTransport({ cartLinesAdd: { cart: WIRE_CART, userErrors: [] } })
    await addCartLines(transport, { cartId: 'c1', lines: [{ merchandiseId: 'v1', quantity: 2 }] })
    expect(transport.sent).toEqual([
      {
        operation: 'CartLinesAdd',
        variables: { cartId: 'c1', lines: [{ merchandiseId: 'v1', quantity: 2 }] },
      },
    ])
  })

  it('sends cartId and lines for update', async () => {
    const transport = stubTransport({ cartLinesUpdate: { cart: WIRE_CART, userErrors: [] } })
    await updateCartLines(transport, { cartId: 'c1', lines: [{ id: 'l1', quantity: 5 }] })
    expect(transport.sent).toEqual([
      {
        operation: 'CartLinesUpdate',
        variables: { cartId: 'c1', lines: [{ id: 'l1', quantity: 5 }] },
      },
    ])
  })

  it('sends cartId and lineIds for remove', async () => {
    const transport = stubTransport({ cartLinesRemove: { cart: WIRE_CART, userErrors: [] } })
    await removeCartLines(transport, { cartId: 'c1', lineIds: ['l1', 'l2'] })
    expect(transport.sent).toEqual([
      { operation: 'CartLinesRemove', variables: { cartId: 'c1', lineIds: ['l1', 'l2'] } },
    ])
  })
})

describe('getCart', () => {
  it('maps an existing cart', async () => {
    const transport = stubTransport({ cart: WIRE_CART })
    const result = await getCart(transport, { cartId: 'gid://shopify/Cart/abc' })
    if (!result.ok || !result.value) throw new Error('expected a cart')
    expect(result.value.checkoutUrl).toBe('https://demo-shop.myshopify.com/cart/c/abc')
  })

  it('resolves to null for an expired cart id', async () => {
    /* Shopify carts expire. A stale id in localStorage is an ordinary event,
       not an error — the store creates a fresh cart. */
    const transport = stubTransport({ cart: null })
    const result = await getCart(transport, { cartId: 'gid://shopify/Cart/gone' })
    expect(result).toEqual({ ok: true, value: null })
  })

  it('reports a schema error when a line is missing its merchandise', async () => {
    const transport = stubTransport({
      cart: {
        ...WIRE_CART,
        lines: { edges: [{ node: { id: 'l1', quantity: 1, merchandise: null } }] },
      },
    })
    const result = await getCart(transport, { cartId: 'c' })
    expect(expectFailure(result)).toMatchObject({ kind: 'schema' })
  })
})
