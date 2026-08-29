import { describe, expect, it } from 'vitest'
import type { StorefrontError, StorefrontResult } from '../errors.ts'
import type { StorefrontTransport } from '../transport.ts'
import { getProduct } from './products.ts'

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

const PRODUCT_NODE = {
  id: 'gid://shopify/Product/1',
  handle: 'stoneware-mug',
  title: 'Stoneware Mug',
  availableForSale: true,
  featuredImage: {
    url: 'https://cdn.shopify.com/s/files/1/mug.jpg',
    altText: 'A speckled mug',
    width: 1200,
    height: 1200,
  },
  priceRange: { minVariantPrice: { amount: '29.00', currencyCode: 'USD' } },
  descriptionHtml: '<p>Thrown by hand.</p>',
  variants: {
    edges: [
      {
        node: {
          id: 'gid://shopify/ProductVariant/11',
          title: 'Speckled',
          availableForSale: true,
          price: { amount: '29.00', currencyCode: 'USD' },
        },
      },
    ],
  },
}

/** A transport that returns one canned payload and records what it was sent. */
function stubTransport(value: unknown): StorefrontTransport & { sent: unknown[] } {
  const sent: unknown[] = []
  return {
    sent,
    async request<TData>(document: string, variables?: Record<string, unknown>) {
      sent.push({ document, variables })
      return { ok: true, value: value as TData } as const
    },
  }
}

describe('getProduct', () => {
  it('maps the wire response into a ProductDetail', async () => {
    const transport = stubTransport({ product: PRODUCT_NODE })
    const result = await getProduct(transport, { handle: 'stoneware-mug' })

    expect(result.ok).toBe(true)
    if (!result.ok || !result.value) throw new Error('expected a product')
    expect(result.value.title).toBe('Stoneware Mug')
    expect(result.value.price).toEqual({ amount: '29.00', currencyCode: 'USD' })
    expect(result.value.image?.altText).toBe('A speckled mug')
    expect(result.value.descriptionHtml).toBe('<p>Thrown by hand.</p>')
    expect(result.value.variants).toHaveLength(1)
    expect(result.value.variants[0]?.id).toBe('gid://shopify/ProductVariant/11')
  })

  it('passes the handle through as a variable', async () => {
    const transport = stubTransport({ product: PRODUCT_NODE })
    await getProduct(transport, { handle: 'stoneware-mug' })
    expect(transport.sent).toEqual([
      {
        document: expect.stringContaining('query ProductDetail'),
        variables: { handle: 'stoneware-mug' },
      },
    ])
  })

  it('resolves to null for an unknown handle rather than failing', async () => {
    const transport = stubTransport({ product: null })
    const result = await getProduct(transport, { handle: 'nope' })
    expect(result).toEqual({ ok: true, value: null })
  })

  it('tolerates a product with no image', async () => {
    const transport = stubTransport({ product: { ...PRODUCT_NODE, featuredImage: null } })
    const result = await getProduct(transport, { handle: 'stoneware-mug' })
    if (!result.ok || !result.value) throw new Error('expected a product')
    expect(result.value.image).toBeNull()
  })

  it('reports a schema error when a non-nullable field is missing', async () => {
    const transport = stubTransport({ product: { ...PRODUCT_NODE, title: null } })
    const result = await getProduct(transport, { handle: 'stoneware-mug' })
    expect(expectFailure(result)).toMatchObject({ kind: 'schema', path: '$.product.title' })
  })

  /**
   * `amount` is a Storefront `Decimal` scalar, typed `unknown` by codegen — a
   * malformed or future response could send anything. This locks in that
   * `requiredString` (`operations/mapping.ts`) actually checks the runtime
   * type rather than trusting the generated type's shape.
   */
  it('reports a schema error when a custom-scalar field is not actually a string', async () => {
    const transport = stubTransport({
      product: {
        ...PRODUCT_NODE,
        priceRange: { minVariantPrice: { amount: 29, currencyCode: 'USD' } },
      },
    })
    const result = await getProduct(transport, { handle: 'stoneware-mug' })
    expect(expectFailure(result)).toMatchObject({
      kind: 'schema',
      path: '$.product.priceRange.minVariantPrice.amount',
    })
  })

  it('propagates a transport failure unchanged', async () => {
    const transport: StorefrontTransport = {
      async request() {
        return { ok: false, error: { kind: 'network', message: 'down', attempts: 3, status: null } }
      },
    }
    const result = await getProduct(transport, { handle: 'x' })
    expect(expectFailure(result)).toMatchObject({ kind: 'network' })
  })
})
