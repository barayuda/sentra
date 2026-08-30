import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'

/**
 * Node and the browser must produce the same SHA-384 for the same bytes.
 *
 * This is the assumption the whole control rests on: digests are published by a
 * Node script and checked by browser code. A mismatch would reject every remote
 * with an error indistinguishable from tampering.
 */
test('Node and SubtleCrypto agree on the digest of the real remote entry', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const manifest = (await (await request.get('/remotes.json')).json()) as { entry: string }[]
  const bytes = await (await request.get(manifest[0].entry)).body()

  const fromNode = createHash('sha384').update(bytes).digest('base64')
  const fromBrowser = await page.evaluate(async (url) => {
    const buffer = await (await fetch(url)).arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-384', buffer)
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
  }, manifest[0].entry)

  expect(fromBrowser).toBe(fromNode)
})
