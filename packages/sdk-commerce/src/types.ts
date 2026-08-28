import type { CurrencyCode } from './generated/graphql.ts'

/**
 * The narrow shapes Sentra applications consume.
 *
 * These are deliberately NOT Shopify's wire types. The operations layer maps
 * wire responses into these, which buys three things: components never see
 * `edges`/`node` plumbing, the mapping becomes the single place a schema
 * mismatch can be detected (hence `SchemaError` is meaningful), and swapping
 * the commerce backend is an SDK-local change rather than a rewrite of every
 * component that touched a product.
 */

/** ISO 4217 code, taken from the generated schema rather than typed as string. */
export type { CurrencyCode }

declare const unsafeHtmlBrand: unique symbol
declare const safeHtmlBrand: unique symbol

/**
 * Merchant-authored HTML exactly as Shopify returned it. **Never** render this.
 *
 * The brand exists to make the dangerous state unspeakable by accident: a
 * template cannot pass `UnsafeHtml` where `SafeHtml` is required, so the only
 * route from the API to the DOM runs through `sanitizeProductHtml`. A plain
 * `string` would let an unsanitised description reach `v-html` with nothing
 * but a code reviewer standing in the way.
 */
export type UnsafeHtml = string & { readonly [unsafeHtmlBrand]: true }

/** HTML that has passed through the sanitiser and may be rendered. */
export type SafeHtml = string & { readonly [safeHtmlBrand]: true }

/**
 * Brands a raw string as unsanitised HTML.
 *
 * Called only by the operations layer, at the point the wire response is read.
 *
 * @param value - Raw HTML from the Storefront API.
 */
export function asUnsafeHtml(value: string): UnsafeHtml {
  return value as UnsafeHtml
}

/** An amount plus its currency, kept as a decimal string exactly as Shopify sends it. */
export interface MoneyV2 {
  /** Decimal string in major units, e.g. `'129.00'`. */
  readonly amount: string
  readonly currencyCode: CurrencyCode
}

/** A product or variant image with the intrinsic dimensions Shopify reports. */
export interface ProductImage {
  readonly url: string
  /** Alt text, or null when the merchant supplied none. */
  readonly altText: string | null
  readonly width: number | null
  readonly height: number | null
}

/** Enough of a product to render a card in a listing. */
export interface ProductSummary {
  readonly id: string
  readonly handle: string
  readonly title: string
  readonly availableForSale: boolean
  /** Lowest variant price — what a listing shows. */
  readonly price: MoneyV2
  readonly image: ProductImage | null
}

/** A purchasable variant. */
export interface ProductVariant {
  readonly id: string
  readonly title: string
  readonly availableForSale: boolean
  readonly price: MoneyV2
}

/** A product detail page's data. */
export interface ProductDetail extends ProductSummary {
  /** Merchant-authored HTML. Sanitise before rendering. */
  readonly descriptionHtml: UnsafeHtml
  readonly variants: readonly ProductVariant[]
}

/** One page of a collection's products, plus the cursor for the next page. */
export interface CollectionPage {
  readonly handle: string
  readonly title: string
  readonly products: readonly ProductSummary[]
  readonly hasNextPage: boolean
  /** Cursor to pass as `after` for the next page; null when exhausted. */
  readonly endCursor: string | null
}

/** One line in the cart. */
export interface CartLine {
  readonly id: string
  readonly quantity: number
  /** Variant id — what mutations address. */
  readonly merchandiseId: string
  readonly productTitle: string
  readonly productHandle: string
  readonly variantTitle: string
  readonly price: MoneyV2
  readonly image: ProductImage | null
}

/** The cart. */
export interface Cart {
  readonly id: string
  /** Shopify-hosted checkout URL — the handoff point out of this application. */
  readonly checkoutUrl: string
  readonly totalQuantity: number
  readonly subtotal: MoneyV2
  readonly lines: readonly CartLine[]
}
