import { describe, expect, it } from 'vitest'
import {
  graphqlUserError,
  isRetryable,
  networkError,
  schemaError,
  throttledError,
} from './errors.ts'
import { err, ok } from './result.ts'

describe('Result', () => {
  it('narrows to the value on success', () => {
    const result = ok<number, string>(41)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(41)
  })

  it('narrows to the error on failure', () => {
    const result = err<string, number>('nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('nope')
  })
})

describe('error constructors', () => {
  it('builds a network error carrying the attempt count and status', () => {
    expect(networkError('connection reset', 3, 502)).toEqual({
      kind: 'network',
      message: 'connection reset',
      attempts: 3,
      status: 502,
    })
  })

  it('builds a throttled error carrying the throttle status', () => {
    const throttleStatus = { maximumAvailable: 1000, currentlyAvailable: 0, restoreRate: 50 }
    expect(throttledError(2, throttleStatus)).toEqual({
      kind: 'throttled',
      message: 'Storefront API throttled the request after 2 attempts',
      attempts: 2,
      throttleStatus,
    })
  })

  it('builds a user error carrying every Shopify userError', () => {
    const userErrors = [
      { field: ['lines', '0', 'quantity'], message: 'must be positive', code: 'INVALID' },
    ]
    const error = graphqlUserError(userErrors)
    expect(error.kind).toBe('graphql_user')
    expect(error.userErrors).toEqual(userErrors)
    expect(error.message).toBe('must be positive')
  })

  it('summarises multiple user errors into one message', () => {
    const error = graphqlUserError([
      { field: null, message: 'first', code: null },
      { field: null, message: 'second', code: null },
    ])
    expect(error.message).toBe('first; second')
  })

  it('falls back to a generic message when Shopify sends no user errors', () => {
    expect(graphqlUserError([]).message).toBe('The Storefront API rejected the request')
  })

  it('builds a schema error naming the offending path', () => {
    expect(schemaError('missing', '$.product.title')).toEqual({
      kind: 'schema',
      message: 'missing',
      path: '$.product.title',
    })
  })
})

describe('isRetryable', () => {
  it('retries transport failures with no HTTP status', () => {
    expect(isRetryable(networkError('timed out', 1, null))).toBe(true)
  })

  it('retries server-side HTTP failures', () => {
    expect(isRetryable(networkError('bad gateway', 1, 502))).toBe(true)
  })

  it('does not retry client-side HTTP failures', () => {
    expect(isRetryable(networkError('unauthorized', 1, 401))).toBe(false)
  })

  it('retries throttling', () => {
    expect(isRetryable(throttledError(1, null))).toBe(true)
  })

  it('does not retry user or schema errors', () => {
    expect(isRetryable(graphqlUserError([]))).toBe(false)
    expect(isRetryable(schemaError('bad shape', '$'))).toBe(false)
  })
})
