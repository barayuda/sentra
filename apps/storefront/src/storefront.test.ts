import { afterEach, describe, expect, it } from 'vitest'
import { getStorefrontClient, setStorefrontClient } from './storefront.ts'

afterEach(() => {
  setStorefrontClient(null)
})

describe('getStorefrontClient', () => {
  it('builds a client lazily and returns the same instance', () => {
    const first = getStorefrontClient()
    expect(first).toBe(getStorefrontClient())
  })

  it('exposes a transport, so the client is fully constructed', () => {
    expect(getStorefrontClient().transport).toBeDefined()
  })

  it('lets a test substitute a stub client', () => {
    const stub = { transport: { async request() {} } } as never
    setStorefrontClient(stub)
    expect(getStorefrontClient()).toBe(stub)
  })
})
