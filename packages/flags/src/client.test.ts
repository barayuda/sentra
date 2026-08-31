import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFlagClient } from './client.ts'
import { OVERRIDES_STORAGE_KEY } from './overrides.ts'
import type { FlagSource } from './types.ts'

const declarations = {
  'checkout.express': { default: false },
  'search.instant': { default: true },
} as const

const never: FlagSource = { load: () => new Promise(() => undefined) }

/**
 * Sets the address bar's query string via `window.history.replaceState`, the
 * same mechanism `overrides.test.ts` uses to control `window.location.search`
 * under happy-dom.
 */
function setQuery(search: string): void {
  window.history.replaceState(null, '', search ? `/?${search}` : '/')
}

describe('createFlagClient', () => {
  beforeEach(() => {
    setQuery('')
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

  it('settles ready on a failed load, not just a successful one', async () => {
    const source: FlagSource = { load: async () => Promise.reject(new Error('down')) }
    const onError = vi.fn()
    const client = createFlagClient({ declarations, source, onError })
    await client.refresh()
    expect(client.ready.value).toBe(true)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(client.isOn('checkout.express')).toBe(false)
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

  it('buckets a numeric source value against the stableId, partitioning below/above/at the rollout', async () => {
    /*
     * Bucket values below are computed from `bucket()` in `./bucket.ts`
     * itself (not re-derived from the rollout being tested, which would make
     * the assertion circular): bucket('user-1:checkout.express') === 24,
     * bucket('user-6:checkout.express') === 95,
     * bucket('user-30:checkout.express') === 54. A rollout of 54 puts
     * 'user-1' strictly below, 'user-6' strictly above, and 'user-30' exactly
     * on the boundary — which must resolve to `false` because resolution
     * uses `<`, not `<=`.
     */
    const source: FlagSource = { load: async () => ({ 'checkout.express': 54 }) }
    const belowClient = createFlagClient({ declarations, source, context: { stableId: 'user-1' } })
    const aboveClient = createFlagClient({ declarations, source, context: { stableId: 'user-6' } })
    const boundaryClient = createFlagClient({
      declarations,
      source,
      context: { stableId: 'user-30' },
    })
    await Promise.all([belowClient.refresh(), aboveClient.refresh(), boundaryClient.refresh()])
    expect(belowClient.isOn('checkout.express')).toBe(true)
    expect(aboveClient.isOn('checkout.express')).toBe(false)
    expect(boundaryClient.isOn('checkout.express')).toBe(false)
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
