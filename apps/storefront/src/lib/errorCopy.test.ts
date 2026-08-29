import type { StorefrontError } from '@sentra/sdk-commerce'
import { describe, expect, it } from 'vitest'
import { errorCopy } from './errorCopy.ts'

describe('errorCopy', () => {
  it('offers a retry for a network failure', () => {
    const copy = errorCopy({ kind: 'network', message: 'ECONNRESET', attempts: 3, status: null })
    expect(copy.retryable).toBe(true)
    expect(copy.title).toBe("We couldn't reach the store")
  })

  it('asks the reader to wait when throttled', () => {
    const copy = errorCopy({ kind: 'throttled', message: 'x', attempts: 3, throttleStatus: null })
    expect(copy.retryable).toBe(true)
    expect(copy.detail).toContain('busy')
  })

  it("shows the store's own message for a user error", () => {
    const copy = errorCopy({
      kind: 'graphql_user',
      message: 'Only 2 left in stock',
      userErrors: [{ field: null, message: 'Only 2 left in stock', code: 'INVALID' }],
    })
    expect(copy.detail).toBe('Only 2 left in stock')
    expect(copy.retryable).toBe(false)
  })

  it("never shows a schema error's technical detail to the reader", () => {
    const copy = errorCopy({ kind: 'schema', message: 'title was null', path: '$.product.title' })
    expect(copy.retryable).toBe(false)
    expect(copy.detail).not.toContain('$.product.title')
    expect(copy.detail).not.toContain('null')
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
      expect(copy.title.length).toBeGreaterThan(0)
      expect(copy.detail.length).toBeGreaterThan(0)
    }
  })
})
