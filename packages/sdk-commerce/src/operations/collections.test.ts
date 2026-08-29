import { describe, expect, it } from 'vitest'
import type { StorefrontError, StorefrontResult } from '../errors.ts'
import type { StorefrontTransport } from '../transport.ts'
import { getCollection } from './collections.ts'

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

function summaryNode(id: string, handle: string) {
  return {
    id,
    handle,
    title: `Product ${id}`,
    availableForSale: true,
    featuredImage: {
      url: `https://cdn.shopify.com/${handle}.jpg`,
      altText: null,
      width: 800,
      height: 800,
    },
    priceRange: { minVariantPrice: { amount: '19.00', currencyCode: 'USD' } },
  }
}

const COLLECTION = {
  collection: {
    handle: 'tableware',
    title: 'Tableware',
    products: {
      pageInfo: { hasNextPage: true, endCursor: 'cursor-2' },
      edges: [{ node: summaryNode('1', 'mug') }, { node: summaryNode('2', 'bowl') }],
    },
  },
}

function stubTransport(value: unknown): StorefrontTransport & { sent: unknown[] } {
  const sent: unknown[] = []
  return {
    sent,
    async request<TData>(document: string, variables?: Record<string, unknown>) {
      sent.push(variables)
      void document
      return { ok: true, value: value as TData } as const
    },
  }
}

describe('getCollection', () => {
  it('flattens edges into a product list with pagination state', async () => {
    const transport = stubTransport(COLLECTION)
    const result = await getCollection(transport, { handle: 'tableware', first: 2 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.title).toBe('Tableware')
    expect(result.value.products.map((product) => product.handle)).toEqual(['mug', 'bowl'])
    expect(result.value.hasNextPage).toBe(true)
    expect(result.value.endCursor).toBe('cursor-2')
  })

  it('sends the cursor as `after` when continuing a page', async () => {
    const transport = stubTransport(COLLECTION)
    await getCollection(transport, { handle: 'tableware', first: 2, after: 'cursor-1' })
    expect(transport.sent).toEqual([{ handle: 'tableware', first: 2, after: 'cursor-1' }])
  })

  it('sends a null cursor for the first page', async () => {
    const transport = stubTransport(COLLECTION)
    await getCollection(transport, { handle: 'tableware', first: 2 })
    expect(transport.sent).toEqual([{ handle: 'tableware', first: 2, after: null }])
  })

  it('reports an unknown collection as a schema error naming the path', async () => {
    const transport = stubTransport({ collection: null })
    const result = await getCollection(transport, { handle: 'nope', first: 2 })
    expect(expectFailure(result)).toMatchObject({ kind: 'schema', path: '$.collection' })
  })

  it('handles an empty but valid collection', async () => {
    const transport = stubTransport({
      collection: {
        handle: 'empty',
        title: 'Empty',
        products: { pageInfo: { hasNextPage: false, endCursor: null }, edges: [] },
      },
    })
    const result = await getCollection(transport, { handle: 'empty', first: 12 })
    if (!result.ok) throw new Error('expected success')
    expect(result.value.products).toEqual([])
    expect(result.value.endCursor).toBeNull()
  })
})
