import { createStorefrontClient, type StorefrontClient } from '@sentra/sdk-commerce'
import { MOCK_SHOP_DOMAIN, MOCK_STOREFRONT_TOKEN } from '@sentra/sdk-commerce/mocks'

/**
 * Whether this build serves data from MSW fixtures.
 *
 * Mock-first is the demo posture, not a testing convenience: a live
 * presentation must not depend on a network, a store staying up, or a rate
 * limit resetting at the wrong moment.
 */
export function mocksEnabled(): boolean {
  return import.meta.env.VITE_SENTRA_MOCKS === 'true'
}

let client: StorefrontClient | null = null

/**
 * Returns the application's Storefront client, constructing it on first use.
 *
 * When mocks are enabled the client points at the mock shop domain — MSW
 * intercepts by URL, so the client is genuinely unaware it is being mocked,
 * and the same code path runs in the demo as against a live store.
 */
export function getStorefrontClient(): StorefrontClient {
  if (client) return client
  const domain = mocksEnabled()
    ? MOCK_SHOP_DOMAIN
    : (import.meta.env.VITE_SENTRA_SHOPIFY_DOMAIN ?? MOCK_SHOP_DOMAIN)
  const token = mocksEnabled()
    ? MOCK_STOREFRONT_TOKEN
    : (import.meta.env.VITE_SENTRA_SHOPIFY_TOKEN ?? MOCK_STOREFRONT_TOKEN)
  client = createStorefrontClient({ domain, token })
  return client
}

/**
 * Replaces (or clears, with `null`) the cached client.
 *
 * An explicit dependency-injection seam rather than a module mock: the same
 * choice `captureWebVitals` made with its injectable reporters. Module mocking
 * would couple every test to this file's import graph, and a store built on a
 * mocked module cannot be exercised against a stub client from a story or an
 * interaction test.
 */
export function setStorefrontClient(next: StorefrontClient | null): void {
  client = next
}
