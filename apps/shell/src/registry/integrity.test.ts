import type { RemoteManifestEntry } from '@sentra/shell-contract'
import { describe, expect, it, vi } from 'vitest'
import { verifyEntries } from './integrity.ts'

const BODY = 'export default {}\n'
/* Computed once with node:crypto and pasted here so the test does not reimplement
   the hashing it is meant to check. Regenerate with:
   node -e "const{createHash}=require('node:crypto');console.log('sha384-'+createHash('sha384').update('export default {}\\n').digest('base64'))" */
const GOOD = 'sha384-SNpRlzP77by+5v1j+1AdwpUGxHIfLCIGex7ULB/QnYaYIllfN/vg3eHeB3qj40az'

/**
 * Builds a fetch stub returning a fixed body.
 *
 * @param body - Response body.
 */
function stubFetch(body: string) {
  return vi.fn(async () => new Response(body))
}

function entry(overrides: Partial<RemoteManifestEntry> = {}): RemoteManifestEntry {
  return { name: 'a', entry: 'https://example.test/remoteEntry.js', basePath: '/a', ...overrides }
}

describe('verifyEntries', () => {
  it('passes an entry whose bytes match its digest', async () => {
    const result = await verifyEntries([entry({ integrity: GOOD })], stubFetch(BODY))
    expect(result.verified).toHaveLength(1)
    expect(result.rejected).toEqual([])
  })

  it('rejects an entry whose bytes do not match its digest', async () => {
    const result = await verifyEntries([entry({ integrity: GOOD })], stubFetch('tampered'))
    expect(result.verified).toEqual([])
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]!.reason).toContain('integrity')
  })

  it('allows an entry with no digest in development, without fetching it', async () => {
    const fetchImpl = stubFetch(BODY)
    const result = await verifyEntries([entry()], fetchImpl, false)
    expect(result.verified).toHaveLength(1)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects an entry with no digest when integrity is required', async () => {
    const fetchImpl = stubFetch(BODY)
    const result = await verifyEntries([entry()], fetchImpl, true)
    expect(result.verified).toEqual([])
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]!.reason).toContain('no integrity digest')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('verifies nothing and rejects nothing for an empty manifest', async () => {
    const result = await verifyEntries([], stubFetch(BODY), true)
    expect(result.verified).toEqual([])
    expect(result.rejected).toEqual([])
  })

  it('rejects an entry whose fetch fails rather than trusting it', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    })
    const result = await verifyEntries([entry({ integrity: GOOD })], fetchImpl)
    expect(result.verified).toEqual([])
    expect(result.rejected[0]!.reason).toContain('offline')
  })

  it('rejects an entry whose fetch returns a non-ok status', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 502 }))
    const result = await verifyEntries([entry({ integrity: GOOD })], fetchImpl)
    expect(result.verified).toEqual([])
    expect(result.rejected[0]!.reason).toContain('502')
  })

  /* Without the up-front guard this case throws out of `verifyEntries` instead
     of returning, which rejects the promise `bootShell` awaits and fails the
     whole shell rather than one remote. The assertion is on the returned shape
     precisely because "it threw" is the behaviour being ruled out. */
  it('rejects every entry with a named reason when SubtleCrypto is unavailable', async () => {
    const real = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
    try {
      const result = await verifyEntries([entry({ integrity: GOOD })], stubFetch(BODY))
      expect(result.verified).toEqual([])
      expect(result.rejected[0]!.reason).toContain('secure context')
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true })
    }
  })

  it('does not fail a platform-only tree over SubtleCrypto it never needed', async () => {
    const real = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
    try {
      await expect(verifyEntries([], stubFetch(BODY), true)).resolves.toEqual({
        verified: [],
        rejected: [],
      })
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true })
    }
  })
})
