import { describe, expect, it } from 'vitest'
import { bucket, fnv1a } from './bucket.ts'

describe('fnv1a', () => {
  it('is deterministic', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'))
  })

  it('differs for different input', () => {
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'))
  })

  it('is always a non-negative 32-bit value', () => {
    expect(fnv1a('anything')).toBeGreaterThanOrEqual(0)
    expect(fnv1a('anything')).toBeLessThan(2 ** 32)
  })

  /*
   * I3: every other assertion in this file computes its expected value with
   * this same `fnv1a()`, so none of them can detect a silent algorithm
   * change — verified live: swapping `FNV_OFFSET_BASIS`/`FNV_PRIME` for a
   * different, still well-distributed constant pair left all 7 original
   * tests green. These two values are published FNV-1a-32 reference vectors
   * (Fowler/Noll/Vo, http://www.isthe.com/chongo/tech/comp/fnv/,
   * "test_fnv.c"), independently re-derived here (not by calling `fnv1a`) as
   * `0x811c9dc5` for the empty string — literally the algorithm's own
   * published offset basis, since FNV-1a's hash after zero rounds is that
   * constant — and `0xe40c292c` for `'a'`, computed by hand-rolling the
   * FNV-1a-32 spec (offset basis `0x811c9dc5`, prime `0x01000193`) in a
   * throwaway script, not by importing `./bucket.ts`. `bucket.ts:8`'s `>>> 0`
   * coerces the result to an unsigned 32-bit integer, hence the decimal form
   * below rather than a signed value.
   */
  it('matches the published FNV-1a-32 reference vector for the empty string', () => {
    expect(fnv1a('')).toBe(0x811c9dc5)
    expect(fnv1a('')).toBe(2166136261)
  })

  it('matches the published FNV-1a-32 reference vector for a non-empty string', () => {
    expect(fnv1a('a')).toBe(0xe40c292c)
    expect(fnv1a('a')).toBe(3826002220)
  })
})

describe('bucket', () => {
  it('is stable for the same id and key', () => {
    expect(bucket('user-1', 'checkout.express')).toBe(bucket('user-1', 'checkout.express'))
  })

  it('differs across keys for the same id', () => {
    const a = bucket('user-1', 'flag.a')
    const b = bucket('user-1', 'flag.b')
    expect(a).not.toBe(b)
  })

  it('is always within 0..99', () => {
    for (let i = 0; i < 500; i += 1) {
      const value = bucket(`user-${i}`, 'flag')
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(100)
    }
  })

  it('distributes roughly evenly, so a rollout percentage means something', () => {
    let under30 = 0
    const total = 5000
    for (let i = 0; i < total; i += 1) {
      if (bucket(`user-${i}`, 'flag') < 30) under30 += 1
    }
    expect(under30 / total).toBeGreaterThan(0.25)
    expect(under30 / total).toBeLessThan(0.35)
  })
})
