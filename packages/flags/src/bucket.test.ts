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
