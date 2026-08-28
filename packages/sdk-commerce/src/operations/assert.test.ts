import { describe, expect, it } from 'vitest'
import type { StorefrontError, StorefrontResult } from '../errors.ts'
import { err, ok } from '../result.ts'
import { SchemaViolation, mapResult, required } from './assert.ts'

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

describe('required', () => {
  it('returns a present value', () => {
    expect(required('mugs', '$.handle')).toBe('mugs')
  })

  it('accepts falsy values that are not null or undefined', () => {
    expect(required(0, '$.count')).toBe(0)
    expect(required('', '$.title')).toBe('')
    expect(required(false, '$.availableForSale')).toBe(false)
  })

  it('throws a SchemaViolation naming the path for null', () => {
    expect(() => required(null, '$.product.title')).toThrow(SchemaViolation)
    try {
      required(null, '$.product.title')
    } catch (error) {
      expect((error as SchemaViolation).path).toBe('$.product.title')
    }
  })

  it('throws a SchemaViolation for undefined', () => {
    expect(() => required(undefined, '$.x')).toThrow(SchemaViolation)
  })
})

describe('mapResult', () => {
  it('maps a success value', () => {
    const result = mapResult(ok<{ n: number }, never>({ n: 1 }), (wire) => wire.n + 1)
    expect(result).toEqual({ ok: true, value: 2 })
  })

  it('passes a failure through untouched', () => {
    const failure = err<StorefrontError, never>({
      kind: 'network',
      message: 'x',
      attempts: 1,
      status: null,
    })
    expect(mapResult(failure as never, () => 'unused')).toBe(failure)
  })

  it('converts a SchemaViolation thrown by the mapper into a schema error', () => {
    const result = mapResult(ok<{ title: string | null }, never>({ title: null }), (wire) =>
      required(wire.title, '$.product.title'),
    )
    expect(expectFailure(result)).toMatchObject({ kind: 'schema', path: '$.product.title' })
  })

  it('lets a non-SchemaViolation error escape', () => {
    expect(() =>
      mapResult(ok<number, never>(1), () => {
        throw new TypeError('programmer error')
      }),
    ).toThrow(TypeError)
  })
})
