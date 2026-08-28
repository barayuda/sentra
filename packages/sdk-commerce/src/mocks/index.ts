/**
 * `@sentra/sdk-commerce/mocks` — the mock-first data source.
 *
 * Exported as a public subpath rather than kept in a test folder because the
 * same handlers serve three consumers: this package's contract tests, the
 * storefront's dev server, and the demo build. One fixture set means the demo
 * cannot drift from what the tests prove.
 */
export {
  FIXTURE_COLLECTION,
  FIXTURE_PRODUCTS,
  FIXTURE_VARIANT_INDEX,
  MOCK_CURRENCY,
  MOCK_SHOP_DOMAIN,
  MOCK_STOREFRONT_TOKEN,
  type WireProduct,
} from './fixtures.ts'
export {
  createMockControl,
  createStorefrontHandlers,
  type MockControl,
  type MockScenario,
} from './handlers.ts'
export { resetMockStore } from './store.ts'
