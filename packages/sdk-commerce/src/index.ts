/**
 * `@sentra/sdk-commerce` — typed Shopify Storefront client.
 *
 * This entry is deliberately free of Vue imports: the transport, operations,
 * and error taxonomy are unit-testable without mounting a component. Vue
 * bindings live behind the `./vue` export, MSW handlers behind `./mocks`.
 */
export { STOREFRONT_API_VERSION, STOREFRONT_SCHEMA_SHA256 } from './version.ts'
export { ok, err, type Result } from './result.ts'
export {
  networkError,
  throttledError,
  graphqlUserError,
  schemaError,
  isRetryable,
  type RequestCost,
  type StorefrontError,
  type StorefrontResult,
  type StorefrontUserError,
  type ThrottleStatus,
} from './errors.ts'
export {
  asUnsafeHtml,
  type Cart,
  type CartLine,
  type CollectionPage,
  type CurrencyCode,
  type MoneyV2,
  type ProductDetail,
  type ProductImage,
  type ProductSummary,
  type ProductVariant,
  type SafeHtml,
  type UnsafeHtml,
} from './types.ts'
export {
  createStorefrontTransport,
  retryDelayMs,
  type StorefrontTransport,
  type StorefrontTransportOptions,
} from './transport.ts'
export {
  createStorefrontClient,
  storefrontEndpoint,
  type StorefrontClient,
  type StorefrontClientOptions,
} from './client.ts'
export { getProduct, type GetProductInput } from './operations/products.ts'
export { getCollection, type GetCollectionInput } from './operations/collections.ts'
export {
  createCart,
  getCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
  type CartLineInput,
  type CartLineUpdate,
} from './operations/cart.ts'
export { SchemaViolation } from './operations/assert.ts'
