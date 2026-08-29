import type { StorefrontResult } from './errors.ts'
import {
  addCartLines,
  createCart,
  getCart,
  removeCartLines,
  updateCartLines,
  type CartLineInput,
  type CartLineUpdate,
} from './operations/cart.ts'
import { getCollection, type GetCollectionInput } from './operations/collections.ts'
import { getProduct, type GetProductInput } from './operations/products.ts'
import {
  createStorefrontTransport,
  type StorefrontTransport,
  type StorefrontTransportOptions,
} from './transport.ts'
import type { Cart, CollectionPage, ProductDetail } from './types.ts'
import { STOREFRONT_API_VERSION } from './version.ts'

/** Configuration for {@link createStorefrontClient}. */
export interface StorefrontClientOptions extends Omit<
  StorefrontTransportOptions,
  'endpoint' | 'token'
> {
  /** Shop domain, e.g. `'demo-shop.myshopify.com'`. */
  readonly domain: string
  /**
   * Public Storefront API access token.
   *
   * Storefront tokens are public-scoped by design — they are meant to be
   * readable in a client bundle. This SDK still treats the value as a
   * credential (never logged, never defaulted to a real value) because the
   * habit is what generalises to the Admin API tokens this pattern invites,
   * and those are catastrophic to expose.
   */
  readonly token: string
  /**
   * Storefront API version.
   *
   * @defaultValue the version of the vendored schema ({@link STOREFRONT_API_VERSION})
   */
  readonly apiVersion?: string
}

/** The application-facing surface of the SDK. */
export interface StorefrontClient {
  /** The underlying transport, exposed for tests and instrumentation. */
  readonly transport: StorefrontTransport
  getProduct(input: GetProductInput): Promise<StorefrontResult<ProductDetail | null>>
  getCollection(input: GetCollectionInput): Promise<StorefrontResult<CollectionPage>>
  createCart(input: { readonly lines?: readonly CartLineInput[] }): Promise<StorefrontResult<Cart>>
  getCart(input: { readonly cartId: string }): Promise<StorefrontResult<Cart | null>>
  addCartLines(input: {
    readonly cartId: string
    readonly lines: readonly CartLineInput[]
  }): Promise<StorefrontResult<Cart>>
  updateCartLines(input: {
    readonly cartId: string
    readonly lines: readonly CartLineUpdate[]
  }): Promise<StorefrontResult<Cart>>
  removeCartLines(input: {
    readonly cartId: string
    readonly lineIds: readonly string[]
  }): Promise<StorefrontResult<Cart>>
}

/**
 * Builds the GraphQL endpoint for a shop and API version.
 *
 * @param domain - Shop domain.
 * @param apiVersion - Calendar API version, e.g. `'2026-04'`.
 */
export function storefrontEndpoint(domain: string, apiVersion: string): string {
  return `https://${domain}/api/${apiVersion}/graphql.json`
}

/**
 * Creates a client: one transport, with the operations bound to it.
 *
 * The client is a thin composition layer on purpose. Every operation is also
 * exported as a free function taking a transport, so tests can exercise one
 * operation against a stub without constructing a client — and so a consumer
 * that only needs products does not pull in the cart code.
 *
 * @param options - See {@link StorefrontClientOptions}.
 */
export function createStorefrontClient(options: StorefrontClientOptions): StorefrontClient {
  const { domain, token, apiVersion = STOREFRONT_API_VERSION, ...transportOptions } = options
  const transport = createStorefrontTransport({
    ...transportOptions,
    endpoint: storefrontEndpoint(domain, apiVersion),
    token,
  })

  return {
    transport,
    getProduct: (input) => getProduct(transport, input),
    getCollection: (input) => getCollection(transport, input),
    createCart: (input) => createCart(transport, input),
    getCart: (input) => getCart(transport, input),
    addCartLines: (input) => addCartLines(transport, input),
    updateCartLines: (input) => updateCartLines(transport, input),
    removeCartLines: (input) => removeCartLines(transport, input),
  }
}
