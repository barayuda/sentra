import { expect, test } from '@playwright/test'

/**
 * Platform-only browser smoke check.
 *
 * The `platform-only` CI job builds, typechecks, lints and tests the
 * stripped tree, but none of those steps ever load a page — which is
 * exactly how a runtime-only defect (a bare specifier left unresolved by
 * `build.rollupOptions.external` in `vite.config.ts`) passed every other
 * gate in that job and only broke once loaded in a real browser with
 * `VITE_SENTRA_MOCKS=true`. This spec closes the class of bug, not just the
 * one instance: it drives the actual stripped-tree build in Chromium and
 * fails on any console or page error, not merely on a nonzero exit code.
 *
 * `playwright.platform-only.config.ts` builds and serves the shell with
 * `VITE_SENTRA_MOCKS=true` — the configuration that starts the mock Service
 * Worker (`src/mocks/browser.ts`) and is the one most likely to hit a
 * stripped-tree runtime path first. Deliberately one spec, one assertion
 * block: this is a smoke check, not a suite — `e2e/shell.spec.ts` and
 * `playwright.config.ts` remain the federated suite for the non-stripped
 * tree.
 */
test('the platform-only shell boots with no console or page errors', async ({ page }) => {
  const errors: string[] = []

  /* Listeners are attached before navigation, not after: a listener wired up
     post-navigation would miss parse-time errors entirely, which is exactly
     the failure mode this check exists to catch — an unresolved `import`
     throws before the page has rendered anything, so there is nothing left
     to attach to once `goto` resolves. */
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    /* This build has no `public/favicon.ico`; the browser's resulting 404 is
       expected and is not the defect class this check watches for. Every
       other console error fails the test, deliberately without a broader
       allowlist — a module-resolution error should be free to say exactly
       what it says. */
    if (/favicon\.ico/.test(message.text())) return
    errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`)
  })

  await page.goto('/')

  /* A positive assertion on the rendered DOM, not merely an absence of
     errors: a page that fails to load at all, or throws before painting
     anything, must fail this test rather than pass it vacuously.
     `scripts/strip-reference.mjs` prunes `remotes.json` to `[]`, so the
     shell's documented empty-manifest path (`registry/boot.ts`, rendering
     `@sentra/ui`'s `RemoteUnavailable`) is what a healthy stripped build is
     expected to show. */
  await expect(page.getByRole('heading', { name: 'The platform is unavailable' })).toBeVisible()
  await expect(page.getByText('No remotes are registered in remotes.json.')).toBeVisible()

  expect(errors).toEqual([])
})
