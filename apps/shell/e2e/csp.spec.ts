import { expect, test, type Page } from '@playwright/test'

/**
 * Seeds the ops role before any application script runs.
 *
 * Matches `shell.spec.ts`'s `grantOps` helper: the default session is
 * `shopper` (spec §7), and `/ops` sits behind `createRoleGuard` (see
 * `apps/shell/src/guards.ts`), which reads the role from `initialSession()`
 * (`apps/shell/src/session.ts`). Writing `sentra:role` via `addInitScript`
 * lets this spec reach the console's real, authenticated view instead of the
 * `/forbidden` guard fallback the Task 1 spike was limited to.
 */
async function grantOps(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('sentra:role', 'ops')
  })
}

/** Records violations from before the first script runs, and reads them back. */
async function collectViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    ;(window as unknown as { __cspViolations: string[] }).__cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      ;(window as unknown as { __cspViolations: string[] }).__cspViolations.push(
        `${event.violatedDirective} blocked ${event.blockedURI}`,
      )
    })
  })
  return () =>
    page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)
}

/**
 * Fails unless the served document actually carries a policy.
 *
 * Every violation assertion below is `toEqual([])`, and a page with **no CSP at
 * all** produces exactly that. Without this precondition, a build where
 * `generate-csp.mjs` never ran — a broken Step 7 wiring, a silent write failure
 * — would turn both violation tests green while the shell ships unprotected.
 * The assertion has to be able to fail for the reason it claims to test.
 */
async function assertPolicyPresent(page: Page): Promise<void> {
  const content = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(
    content,
    'no CSP meta tag in the served document: generate-csp.mjs did not run, so a zero-violation result proves nothing',
  ).not.toBeNull()
  expect(content).toContain("default-src 'self'")
  expect(content).toContain("object-src 'none'")
}

/**
 * The shell's CSP must permit exactly what federation needs and nothing more.
 *
 * The oracle is the browser's own `securitypolicyviolation` event. It is
 * registered through `addInitScript`, not after `page.goto`, because the Task 1
 * spike found that a listener attached post-navigation silently misses every
 * violation raised during the initial parse — which is most of them.
 *
 * A policy that is too strict shows up here as a violation. A policy that is too
 * loose is caught by the unit tests over `buildCspPolicy`, which assert the
 * locked-down directives and the refusal to widen `script-src` explicitly.
 */
test('loads the storefront remote with zero CSP violations', async ({ page }) => {
  const read = await collectViolations(page)

  await page.goto('/shop')
  await assertPolicyPresent(page)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  expect(await read()).toEqual([])
})

/**
 * The console remote, reached past its role guard into its real UI.
 *
 * The Task 1 spike could only reach the console's "you don't have access"
 * fallback, so it could not rule out that the console's real UI needs
 * `style-src 'unsafe-inline'`. `grantOps` (above) reaches the actual
 * `OrdersView`, closing that gap: this test's zero-violation result is
 * evidence about the console's authenticated UI, not about its role guard.
 */
test('loads the console remote past its role guard with zero CSP violations', async ({ page }) => {
  const read = await collectViolations(page)
  await grantOps(page)

  await page.goto('/ops')
  await assertPolicyPresent(page)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  expect(await read()).toEqual([])
})

test('serves a policy that names every remote origin in the manifest', async ({ page }) => {
  await page.goto('/')
  const content = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')

  expect(content).not.toBeNull()

  const manifest = (await (await page.request.get('/remotes.json')).json()) as {
    entry: string
  }[]
  /* An empty manifest makes the loop below vacuous: it would assert nothing and
     still pass. In a full tree the shell has remotes, so an empty manifest here
     means the fixture is wrong, not that there is nothing to check. */
  expect(
    manifest.length,
    'manifest is empty, so the origin check below asserts nothing',
  ).toBeGreaterThan(0)
  for (const entry of manifest) {
    expect(content).toContain(new URL(entry.entry).origin)
  }
})
