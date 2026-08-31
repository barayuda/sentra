import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFlagClient } from './client.ts'
import { OVERRIDES_STORAGE_KEY } from './overrides.ts'
import type { FlagSource } from './types.ts'

const declarations = {
  'checkout.express': { default: false },
  'search.instant': { default: true },
} as const

const never: FlagSource = { load: () => new Promise(() => undefined) }

describe('createFlagClient', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns declared defaults before the source resolves', () => {
    const client = createFlagClient({ declarations, source: never })
    expect(client.isOn('checkout.express')).toBe(false)
    expect(client.isOn('search.instant')).toBe(true)
  })

  it('is not ready before the source resolves', () => {
    expect(createFlagClient({ declarations, source: never }).ready.value).toBe(false)
  })

  it('adopts source values after refresh', async () => {
    const source: FlagSource = { load: async () => ({ 'checkout.express': true }) }
    const client = createFlagClient({ declarations, source })
    await client.refresh()
    expect(client.isOn('checkout.express')).toBe(true)
    expect(client.ready.value).toBe(true)
  })

  it('keeps declared defaults for keys the source omits', async () => {
    const source: FlagSource = { load: async () => ({ 'checkout.express': true }) }
    const client = createFlagClient({ declarations, source })
    await client.refresh()
    expect(client.isOn('search.instant')).toBe(true)
  })

  it('keeps the last good snapshot when a refresh fails', async () => {
    let call = 0
    const source: FlagSource = {
      load: async () => {
        call += 1
        if (call === 1) return { 'checkout.express': true }
        throw new Error('backend down')
      },
    }
    const onError = vi.fn()
    const client = createFlagClient({ declarations, source, onError })
    await client.refresh()
    await client.refresh()
    expect(client.isOn('checkout.express')).toBe(true)
    expect(onError).toHaveBeenCalled()
  })

  it('never throws when the source rejects', async () => {
    const source: FlagSource = { load: async () => Promise.reject(new Error('down')) }
    const client = createFlagClient({ declarations, source })
    await expect(client.refresh()).resolves.toBeUndefined()
    expect(client.isOn('checkout.express')).toBe(false)
  })

  it('buckets a numeric source value against the stableId', async () => {
    const source: FlagSource = { load: async () => ({ 'checkout.express': 100 }) }
    const client = createFlagClient({
      declarations,
      source,
      context: { stableId: 'user-1' },
    })
    await client.refresh()
    expect(client.isOn('checkout.express')).toBe(true)
  })

  it('returns the declared default for a rollout with no stableId', async () => {
    const source: FlagSource = { load: async () => ({ 'checkout.express': 100 }) }
    const client = createFlagClient({ declarations, source })
    await client.refresh()
    expect(client.isOn('checkout.express')).toBe(false)
  })

  it('drops undeclared attribute keys before they reach the source', async () => {
    const load = vi.fn(async () => ({}))
    const client = createFlagClient({
      declarations,
      source: { load },
      allowedAttributeKeys: ['plan'],
      context: { stableId: 'u', attributes: { plan: 'pro', email: 'a@b.com' } },
    })
    await client.refresh()
    expect(load).toHaveBeenCalledWith({ stableId: 'u', attributes: { plan: 'pro' } })
  })

  /*
   * Nothing above populates the override query string or localStorage, so
   * `readOverrides` returns `{}` regardless of which way `allowOverrides`
   * defaults — every test above would pass whether the default is fail-open
   * or fail-closed. This test is the one that actually distinguishes them:
   * an override is set, `allowOverrides` is omitted, and the source never
   * resolves, so the only way `isOn` could see the override is a fail-open
   * default reading it anyway.
   */
  it('does not apply a stored override when allowOverrides is omitted (fail-closed default)', () => {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify({ 'checkout.express': true }))
    const client = createFlagClient({ declarations, source: never })
    expect(client.isOn('checkout.express')).toBe(false)
  })
})
