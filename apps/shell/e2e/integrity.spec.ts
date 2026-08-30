import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

/**
 * Rewrites the served manifest, stamping each entry with a digest.
 *
 * Digests are injected in flight rather than committed to
 * `apps/shell/public/remotes.json`, per Ruling PF-1: a committed digest would
 * have to byte-match a build produced elsewhere with different environment
 * variables, and a stale one fails closed in production for a reason that
 * looks exactly like an attack.
 *
 * @param page - The page whose network to intercept.
 * @param digestFor - Given the entry's real bytes, the digest to publish.
 */
async function stampManifest(page: Page, digestFor: (bytes: Buffer) => string): Promise<void> {
  /* `page.route` never sees this request: the shell's E2E build runs with
     `VITE_SENTRA_MOCKS=true`, which registers MSW's Service Worker, and a
     Service Worker's own `fetch()` pass-through is a network event outside
     the page's frame — Playwright's page-scoped routing does not observe it.
     `context.route` does, because it intercepts at the browser context rather
     than the frame. Confirmed against the real preview build: `page.route`
     here fired zero times and both tests below failed by finding every
     remote unverified rather than by finding the intended digest outcome. */
  await page.context().route('**/remotes.json', async (route) => {
    const entries = (await (await route.fetch()).json()) as {
      name: string
      entry: string
      integrity?: string
    }[]
    for (const entry of entries) {
      const bytes = await (await page.request.get(entry.entry)).body()
      entry.integrity = digestFor(bytes)
    }
    await route.fulfill({ json: entries })
  })
}

/**
 * A remote whose published digest does not match its bytes must not execute.
 *
 * The pair below is the whole point. The first test proves the control
 * *refuses*; the second proves it does not refuse everything — a check that
 * blocked every remote unconditionally would pass the first test alone while
 * being completely broken. Neither test can pass with the integrity check
 * removed: without it the first would load the remote and fail.
 */
test('refuses a remote whose published digest does not match its bytes', async ({ page }) => {
  await stampManifest(page, () => `sha384-${'A'.repeat(64)}`)

  await page.goto('/shop')
  /* `.first()`: `stampManifest` tampers every entry the manifest carries, not
     just storefront's, so both remotes are rejected here — the storefront's
     own `RemoteUnavailable` route (an `<h1>`) and a toast reporting the
     console's rejection are both "unavailable" text on this page at once.
     Either one visible proves the control fired; picking one avoids a
     strict-mode violation over which. */
  await expect(page.getByText(/unavailable/i).first()).toBeVisible()
})

test('loads a remote whose published digest matches its bytes', async ({ page }) => {
  await stampManifest(
    page,
    (bytes) => `sha384-${createHash('sha384').update(bytes).digest('base64')}`,
  )

  await page.goto('/shop')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText(/unavailable/i)).toHaveCount(0)
})

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
