import { describe, expect, it, vi } from 'vitest'
import { fetchRemoteManifest } from './manifest.ts'

const GOOD = [
  { name: 'storefront', entry: 'http://localhost:4173/remoteEntry.js', basePath: '/shop' },
  { name: 'console', entry: 'http://localhost:4174/remoteEntry.js', basePath: '/ops' },
]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchRemoteManifest', () => {
  it('parses a well-formed manifest', async () => {
    const result = await fetchRemoteManifest(
      '/remotes.json',
      vi.fn(async () => jsonResponse(GOOD)),
    )
    expect(result.ok && result.value.entries).toHaveLength(2)
  })

  it('reports a missing manifest as an error, not an exception', async () => {
    /* The body is a well-formed manifest on purpose: if the status check is
       ever removed or inverted, this body would parse successfully and the
       assertion below would fail, proving the status check — not the JSON
       parse — is what this test actually exercises. */
    const result = await fetchRemoteManifest(
      '/remotes.json',
      vi.fn(async () => jsonResponse(GOOD, 404)),
    )
    expect(result.ok).toBe(false)
  })

  it('reports a non-JSON body as an error', async () => {
    const result = await fetchRemoteManifest(
      '/remotes.json',
      vi.fn(async () => new Response('<!doctype html>', { status: 200 })),
    )
    expect(result.ok).toBe(false)
  })

  it('reports a network failure as an error', async () => {
    const result = await fetchRemoteManifest(
      '/remotes.json',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(result.ok).toBe(false)
  })

  it('keeps the good entries and reports the bad one', async () => {
    const mixed = [...GOOD, { name: 'evil', entry: 'javascript:alert(1)', basePath: '/x' }]
    const result = await fetchRemoteManifest(
      '/remotes.json',
      vi.fn(async () => jsonResponse(mixed)),
    )
    expect(result.ok && result.value.entries).toHaveLength(2)
    expect(result.ok && result.value.rejected).toHaveLength(1)
  })
})
