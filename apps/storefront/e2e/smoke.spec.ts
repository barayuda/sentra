import { expect, test } from '@playwright/test'

/**
 * One happy path, end to end, against the built application.
 *
 * Deliberately a single flow rather than a suite: unit and component tests
 * already cover branches cheaply, so the E2E gate's job is to prove the pieces
 * are actually connected in a real browser — routing, the Service Worker, the
 * cart's persistence, and the sanitiser.
 */
test.describe('storefront happy path', () => {
  test('browse, view a product, and add it to the cart', async ({ page }) => {
    await page.goto('/')

    /* The listing renders from MSW fixtures. */
    const grid = page.getByRole('list', { name: 'Products' })
    await expect(grid).toBeVisible()
    await expect(page.getByTestId('product-card').first()).toBeVisible()

    /* Open the first product. */
    await page.getByTestId('product-card').first().getByRole('button').first().click()
    await expect(page).toHaveURL(/\/products\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    /* The description renders as formatted text — and neither payload fired. */
    const description = page.getByTestId('rich-text')
    await expect(description).toBeVisible()
    await expect(description.locator('script')).toHaveCount(0)
    await expect(description.locator('[onerror]')).toHaveCount(0)
    expect(await page.evaluate(() => 'pwned' in window)).toBe(false)

    /* Add to cart: the toast confirms, the header count updates. */
    await page.getByRole('button', { name: 'Add to cart' }).click()
    await expect(page.getByText('Added to cart')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Cart/ })).toContainText('(1)')

    /* The drawer shows the line and a checkout handoff. */
    await page.getByRole('button', { name: /^Cart/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('cart-subtotal')).not.toBeEmpty()
    await expect(dialog.getByRole('link', { name: 'Checkout' })).toHaveAttribute(
      'href',
      /myshopify\.com/,
    )
  })

  test('restores the cart across an in-app navigation', async ({ page }) => {
    /**
     * Ruling 22: a hard `page.reload()` is deliberately NOT used here. The mock
     * cart backend (`packages/sdk-commerce/src/mocks/store.ts`) is a plain
     * module-level `Map` with no persistence layer, so a reload re-executes the
     * module graph and wipes it — `restore()` then correctly (per its own
     * reviewed design) treats the now-404ing cart as expired and drops the
     * stored id. That is the mock-first architecture's honest limitation, not
     * an application bug: a real Shopify cart lives server-side and survives a
     * refresh; this demo's mock does not, and giving it browser-storage-backed
     * persistence would mean threading `sessionStorage` calls into a file that
     * also runs under `@sentra/sdk-commerce`'s Node-environment contract tests,
     * where no such global exists.
     *
     * What this demo genuinely guarantees — and what this test proves — is
     * that the cart survives an in-app ROUTE CHANGE, which is the real
     * shopping flow (browse → view a product → back to the collection).
     */
    await page.goto('/')
    await page.getByTestId('product-card').first().getByRole('button').first().click()
    await page.getByRole('button', { name: 'Add to cart' }).click()
    await expect(page.getByRole('button', { name: /^Cart/ })).toContainText('(1)')

    await page.getByRole('link', { name: 'Sentra' }).click()
    await expect(page.getByRole('button', { name: /^Cart/ })).toContainText('(1)')
  })

  test('surfaces a failure and recovers when adding to cart fails', async ({ page }) => {
    /**
     * Ruling 23: this test originally tried to fail the collection grid's
     * NEXT-page load by scrolling after setting the mock scenario. That is
     * unreachable in practice: `ProductGrid.vue`'s `endReached` watch fires
     * `{ immediate: true }` so a short first page still loads its successor,
     * and with 24 fixture products at `pageSize: 12` both pages satisfy the
     * grid's render window and load in the same tick chain before any test
     * action can run — confirmed by instrumenting real network requests, and
     * confirmed unfixable via `page.route()` because MSW's Service Worker
     * satisfies these requests without the request ever reaching Chromium's
     * CDP network layer. That inline-error state is already covered
     * exhaustively by `CollectionView.test.ts`'s unit tests.
     *
     * `ProductView.vue`'s add-to-cart failure path has no such race: it is a
     * direct user click, a direct async call, and a `role="alert"` toast on
     * failure — nothing else is fetching concurrently on this page.
     */
    await page.goto('/')
    await page.getByTestId('product-card').first().getByRole('button').first().click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.evaluate(() => {
      if (window.sentraMocks) window.sentraMocks.scenario = 'network'
    })
    await page.getByRole('button', { name: 'Add to cart' }).click()
    await expect(page.getByRole('alert')).toContainText(/check your connection/i)
    await expect(page.getByRole('button', { name: /^Cart/ })).not.toContainText('(1)')

    await page.evaluate(() => {
      if (window.sentraMocks) window.sentraMocks.scenario = 'ok'
    })
    await page.getByRole('button', { name: 'Add to cart' }).click()
    await expect(page.getByRole('button', { name: /^Cart/ })).toContainText('(1)')
  })
})
