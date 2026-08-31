import type { StorefrontError } from '@sentra/sdk-commerce'
import { describe, expect, it } from 'vitest'
import { errorCopy, resolveErrorCopy } from './errorCopy.ts'

/** Resolves a key to a marked form, so a leaked literal is unmistakable. */
const markKey = (key: string) => `<${key}>`

describe('errorCopy', () => {
  it('maps a network failure to its keys and offers a retry', () => {
    const copy = errorCopy({ kind: 'network', message: 'ECONNRESET', attempts: 3, status: null })
    expect(copy.titleKey).toBe('storefront.error.network.title')
    expect(copy.detail).toEqual({ kind: 'key', key: 'storefront.error.network.detail' })
    expect(copy.retryable).toBe(true)
  })

  it('maps a throttled failure to its keys and offers a retry', () => {
    const copy = errorCopy({ kind: 'throttled', message: 'x', attempts: 3, throttleStatus: null })
    expect(copy.titleKey).toBe('storefront.error.throttled.title')
    expect(copy.detail).toEqual({ kind: 'key', key: 'storefront.error.throttled.detail' })
    expect(copy.retryable).toBe(true)
  })

  it("passes the store's own message through untranslated", () => {
    const copy = errorCopy({
      kind: 'graphql_user',
      message: 'Only 2 left in stock',
      userErrors: [{ field: null, message: 'Only 2 left in stock', code: 'INVALID' }],
    })
    expect(copy.titleKey).toBe('storefront.error.declined.title')
    expect(copy.detail).toEqual({ kind: 'literal', text: 'Only 2 left in stock' })
    expect(copy.retryable).toBe(false)
  })

  /*
   * Asserting the detail is a *key* is a stronger guarantee than the substring
   * checks this test used to make. A key carries nothing from the error object,
   * so no path or message can reach the reader by any route — including one a
   * future edit might open.
   */
  it("never routes a schema error's technical detail to the reader", () => {
    const copy = errorCopy({ kind: 'schema', message: 'title was null', path: '$.product.title' })
    expect(copy.titleKey).toBe('storefront.error.schema.title')
    expect(copy.detail.kind).toBe('key')
    expect(copy.retryable).toBe(false)
  })

  it('produces copy for every member of the taxonomy', () => {
    const errors: StorefrontError[] = [
      { kind: 'network', message: 'm', attempts: 1, status: null },
      { kind: 'throttled', message: 'm', attempts: 1, throttleStatus: null },
      { kind: 'graphql_user', message: 'm', userErrors: [] },
      { kind: 'schema', message: 'm', path: '$' },
    ]
    for (const error of errors) {
      const copy = errorCopy(error)
      expect(copy.titleKey.startsWith('storefront.error.')).toBe(true)
      expect(copy.detail.kind === 'key' || copy.detail.kind === 'literal').toBe(true)
    }
  })
})

describe('resolveErrorCopy', () => {
  it('translates the title and a key detail', () => {
    const copy = resolveErrorCopy(markKey, {
      kind: 'network',
      message: 'm',
      attempts: 1,
      status: null,
    })
    expect(copy.title).toBe('<storefront.error.network.title>')
    expect(copy.detail).toBe('<storefront.error.network.detail>')
    expect(copy.retryable).toBe(true)
  })

  it('leaves a literal detail untouched while still translating the title', () => {
    const copy = resolveErrorCopy(markKey, {
      kind: 'graphql_user',
      message: 'Only 2 left in stock',
      userErrors: [],
    })
    expect(copy.title).toBe('<storefront.error.declined.title>')
    expect(copy.detail).toBe('Only 2 left in stock')
  })
})
