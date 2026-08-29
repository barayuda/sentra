import { describe, expect, it } from 'vitest'
import { authError, isRetryable, networkError, schemaError, validationError } from './errors.ts'

describe('OpsError', () => {
  it('retries a transport failure with no response', () => {
    expect(isRetryable(networkError('connection reset', null))).toBe(true)
  })

  it('retries a server-side failure', () => {
    expect(isRetryable(networkError('upstream responded 503', 503))).toBe(true)
  })

  it('does not retry a request the server understood and refused', () => {
    expect(isRetryable(networkError('upstream responded 404', 404))).toBe(false)
  })

  it('does not retry auth, validation, or schema failures', () => {
    expect(isRetryable(authError('token rejected'))).toBe(false)
    expect(isRetryable(validationError('must be enabled or disabled', 'state'))).toBe(false)
    expect(isRetryable(schemaError('missing field', '$.orders[0].id'))).toBe(false)
  })

  it('carries the offending field on a validation failure', () => {
    const error = validationError('unknown flag', 'key')
    expect(error).toEqual({ kind: 'validation', message: 'unknown flag', field: 'key' })
  })
})
