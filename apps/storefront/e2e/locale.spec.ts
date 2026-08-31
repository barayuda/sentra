import { expect, test } from '@playwright/test'

/*
 * Asserts on a product-specific translated string rather than "some Indonesian
 * text exists", and on `<html lang>` — the attribute the axe `html-has-lang`
 * rule reads. A switcher that changes copy but leaves `lang="en"` is a real
 * accessibility defect that a copy-only assertion would pass.
 */
test('switching to Indonesian translates the page and updates the lang attribute', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await page.getByRole('combobox', { name: /language|bahasa/i }).selectOption('id')

  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.getByRole('button', { name: /Keranjang/ })).toBeVisible()
})

test('the chosen locale survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: /language|bahasa/i }).selectOption('id')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
})
