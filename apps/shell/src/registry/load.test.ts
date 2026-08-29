import type { RemoteModule } from '@sentra/shell-contract'
import { describe, expect, it, vi } from 'vitest'
import { loadRemotes } from './load.ts'

const ENTRIES = [
  { name: 'storefront', entry: 'http://localhost:4173/remoteEntry.js', basePath: '/shop' },
  { name: 'console', entry: 'http://localhost:4174/remoteEntry.js', basePath: '/ops' },
]

const MODULE: RemoteModule = {
  routes: [{ path: '', component: { template: '<div />' } }],
  register: () => undefined,
}

describe('loadRemotes', () => {
  it('loads every remote that resolves', async () => {
    const outcomes = await loadRemotes(ENTRIES, async () => MODULE)
    expect(outcomes.every((outcome) => outcome.status === 'loaded')).toBe(true)
  })

  it('keeps the working remote when one fails', async () => {
    const outcomes = await loadRemotes(ENTRIES, async (name) => {
      if (name === 'console') throw new Error('404 fetching remoteEntry.js')
      return MODULE
    })
    expect(outcomes.filter((outcome) => outcome.status === 'loaded')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'failed')).toHaveLength(1)
  })

  it('records a reason for the failure', async () => {
    const outcomes = await loadRemotes(ENTRIES, async (name) => {
      if (name === 'console') throw new Error('404 fetching remoteEntry.js')
      return MODULE
    })
    const failed = outcomes.find((outcome) => outcome.status === 'failed')
    expect(failed?.status === 'failed' && failed.reason).toMatch(/404/)
  })

  it('treats a module with no routes array as a failure, not a load', async () => {
    const outcomes = await loadRemotes([ENTRIES[0]!], async () => ({}) as RemoteModule)
    expect(outcomes[0]?.status).toBe('failed')
  })

  /*
   * Correction 5: the brief's original version of this test asserted
   * `started === ['storefront', 'console']` after the whole call resolved,
   * which a strictly serial `for…await` loop produces identically — the
   * assertion passes against the very bug it claims to catch, because a
   * serial loop still visits entries in document order.
   *
   * The version below blocks the first remote's load on a promise this test
   * controls, flushes the microtask queue, and asserts that the *second*
   * remote has already started — while the first is still pending. A serial
   * loop cannot produce that state: it would not call `loadImpl('console')`
   * until the `storefront` promise settles. Only a concurrent implementation
   * (e.g. `entries.map(...)` fired into `Promise.all`) starts every load
   * before any of them resolves.
   */
  it('loads the remotes concurrently rather than in series', async () => {
    const started: string[] = []
    let releaseStorefront!: () => void
    const storefrontGate = new Promise<void>((resolve) => {
      releaseStorefront = resolve
    })

    const loadImpl = vi.fn(async (name: string) => {
      started.push(name)
      if (name === 'storefront') await storefrontGate
      return MODULE
    })

    const pending = loadRemotes(ENTRIES, loadImpl)

    /* Flush the microtask queue without resolving the gate, so every
       synchronous-until-first-await step of a concurrent implementation gets
       a chance to run. */
    await Promise.resolve()
    await Promise.resolve()

    expect(started).toEqual(['storefront', 'console'])

    releaseStorefront()
    const outcomes = await pending
    expect(outcomes.every((outcome) => outcome.status === 'loaded')).toBe(true)
    expect(loadImpl).toHaveBeenCalledTimes(2)
  })
})
