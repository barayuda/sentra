/**
 * `@sentra/sdk-commerce/vue` — Vue bindings.
 *
 * Separate from the core entry so the transport, operations, and error taxonomy
 * remain testable — and consumable — without Vue. `vue` is an optional peer of
 * this package for exactly that reason.
 */
export {
  storefrontPlugin,
  useStorefront,
  STOREFRONT_INJECTION_KEY,
  type StorefrontPluginOptions,
} from './plugin.ts'
export {
  useStorefrontQuery,
  useProduct,
  useCollection,
  type CollectionFeed,
  type StorefrontQuery,
  type StorefrontQueryOptions,
  type UseCollectionOptions,
} from './queries.ts'
