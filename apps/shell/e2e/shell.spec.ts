import { expect, test, type Page } from '@playwright/test'

/**
 * Seeds the ops role before any application script runs.
 *
 * The default session is `shopper` (spec §7), so a test that only wants to
 * reach the console would otherwise spend its assertions on the role guard.
 * `addInitScript` writes the key the shell reads at boot, which keeps the
 * guard itself the subject of exactly one test — the one below that walks it.
 */
async function grantOps(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('sentra:role', 'ops')
  })
}

test.describe('federated shell', () => {
  test('renders the storefront remote under the shell chrome', async ({ page }) => {
    await page.goto('/shop')
    /* Chrome from the host, content from a remote fetched over the network.
       The heading and product list are named specifically — the storefront's
       collection title ("Tableware", from the MSW fixture) and its ARIA-labelled
       product grid. A generic `heading, level 1` check would also pass against
       the shell's own 404 view, which renders an unrelated `<h1>` — that
       looser assertion would not fail if route grafting broke. */
    await expect(page.getByRole('link', { name: 'Sentra' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Tableware' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Products' })).toBeVisible()
  })

  test('blocks the console until the role is switched, then loads it', async ({ page }) => {
    /* Spec §9's walk: `/ops` blocked → switch role → `/ops` loads. The remote
       is fetched from a different origin than the host serving this page. */
    await page.goto('/ops/orders')
    await expect(page).toHaveURL(/\/forbidden/)

    await page.getByLabel('Role').selectOption('ops')
    await page.goto('/ops/orders')

    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
    await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible()
  })

  test('navigates between two remotes without a full page load', async ({ page }) => {
    await grantOps(page)
    await page.goto('/shop')
    /* Stamp the window. A full document load clears it; a client-side route
       change does not. This demonstrates that cross-remote navigation is
       client-side, with no full document reload — it does not, on its own,
       prove a single shared router instance: the link clicked is the shell's
       own `RouterLink`, which calls `pushState` regardless of how many router
       copies a duplicated `vue-router` would have created. */
    await page.evaluate(() => {
      ;(window as unknown as { __sentraMark?: number }).__sentraMark = 42
    })
    await page.getByRole('link', { name: 'Ops' }).click()
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
    const mark = await page.evaluate(
      () => (window as unknown as { __sentraMark?: number }).__sentraMark,
    )
    expect(mark).toBe(42)
  })

  test("the shell's cart badge reflects the storefront's cart", async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByRole('button', { name: /Cart, 0 items/ })).toBeVisible()
    /* `/shop` is the collection listing; the add-to-cart affordance lives on
       the product detail page (`ProductView.vue`), not on the collection
       (`packages/ui`'s `ProductCard` has no add-to-cart button of its own).
       The flow below opens the first product before adding it — the same
       selector the storefront's own standalone E2E suite uses. */
    await page.getByTestId('product-card').first().getByRole('button').first().click()
    await page.getByRole('button', { name: 'Add to cart' }).click()
    await expect(page.getByRole('button', { name: /Cart, 1 items/ })).toBeVisible()
  })

  test('the header can open a drawer the shell never imported', async ({ page }) => {
    await page.goto('/shop')
    await page.getByRole('button', { name: /Cart, 0 items/ }).click()
    await expect(page.getByRole('dialog', { name: /cart/i })).toBeVisible()
  })

  test('a broken remote leaves the other one working', async ({ page }) => {
    await grantOps(page)
    await page.goto('/ops/orders?break=console')
    await expect(page.getByRole('alert')).toContainText('console is unavailable')
    await page.getByRole('link', { name: 'Shop' }).click()
    /* Named, not generic: `RemoteUnavailable` renders its own `<h1>` (e.g.
       "storefront is unavailable"), so an unqualified `heading, level 1`
       check would still pass even if this mutation had knocked out every
       remote instead of just the named one. Naming the collection's actual
       heading is what makes this assertion specific to "the storefront still
       works". */
    await expect(page.getByRole('heading', { level: 1, name: 'Tableware' })).toBeVisible()
  })
})
