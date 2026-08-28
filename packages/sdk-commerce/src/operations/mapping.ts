import type { MoneyV2, ProductImage, ProductSummary, ProductVariant } from '../types.ts'
import type { CurrencyCode } from '../generated/graphql.ts'
import { required, SchemaViolation } from './assert.ts'

/**
 * Wire shapes, described structurally rather than imported from the generated
 * types.
 *
 * The generated `…Query` types describe the *whole* response for one operation,
 * so a shared mapper cannot be typed against them without picking one operation
 * arbitrarily. These interfaces name only the fields the fragments guarantee —
 * and codegen already proved those fields exist by validating the documents
 * against the vendored schema, so this is narrowing, not re-declaring.
 */
interface WireMoney {
  /**
   * Shopify's `Decimal` scalar. Codegen has no static type for a custom scalar
   * it was not told how to map, so the generated types carry this as `unknown`
   * rather than `string` — {@link requiredString} is what actually confirms
   * the runtime value at the response boundary.
   */
  readonly amount?: unknown
  readonly currencyCode?: string | null
}

interface WireImage {
  /** Shopify's `URL` scalar — `unknown` in the generated types; see {@link WireMoney.amount}. */
  readonly url?: unknown
  readonly altText?: string | null
  readonly width?: number | null
  readonly height?: number | null
}

interface WireProductSummary {
  readonly id?: string | null
  readonly handle?: string | null
  readonly title?: string | null
  readonly availableForSale?: boolean | null
  readonly featuredImage?: WireImage | null
  readonly priceRange?: { readonly minVariantPrice?: WireMoney | null } | null
}

interface WireVariant {
  readonly id?: string | null
  readonly title?: string | null
  readonly availableForSale?: boolean | null
  readonly price?: WireMoney | null
}

/**
 * Asserts a value is present and is actually a string.
 *
 * `Decimal`, `URL`, and `HTML` are custom Storefront scalars the generated
 * types type as `unknown` — codegen was never told a concrete TypeScript
 * shape for them. Shopify always serialises each as a JSON string, but that is
 * a wire-format fact the type system cannot see, so unlike {@link required}
 * (which only guards nullability) this also checks the runtime type before a
 * domain field declared `string` accepts the value.
 *
 * @param value - The value to check.
 * @param path - JSON path used in the error.
 * @throws SchemaViolation when the value is missing or not a string.
 */
export function requiredString(value: unknown, path: string): string {
  const present = required(value, path)
  if (typeof present !== 'string') throw new SchemaViolation(path)
  return present
}

/**
 * Maps a money value.
 *
 * @param wire - The wire money object.
 * @param path - JSON path for error reporting.
 */
export function mapMoney(wire: WireMoney | null | undefined, path: string): MoneyV2 {
  const money = required(wire, path)
  return {
    amount: requiredString(money.amount, `${path}.amount`),
    currencyCode: requiredString(money.currencyCode, `${path}.currencyCode`) as CurrencyCode,
  }
}

/**
 * Maps an image, preserving "no image" as null rather than inventing a
 * placeholder — the component layer owns that decision.
 *
 * @param wire - The wire image object, possibly null.
 * @param path - JSON path for error reporting.
 */
export function mapImage(wire: WireImage | null | undefined, path: string): ProductImage | null {
  if (!wire) return null
  return {
    url: requiredString(wire.url, `${path}.url`),
    altText: wire.altText ?? null,
    width: wire.width ?? null,
    height: wire.height ?? null,
  }
}

/**
 * Maps the `ProductSummaryFields` fragment.
 *
 * Shared by listing and detail so the two can never disagree about what a
 * product's price or image means.
 *
 * @param wire - A product node.
 * @param path - JSON path for error reporting.
 */
export function mapProductSummary(
  wire: WireProductSummary | null | undefined,
  path: string,
): ProductSummary {
  const node = required(wire, path)
  return {
    id: required(node.id, `${path}.id`),
    handle: required(node.handle, `${path}.handle`),
    title: required(node.title, `${path}.title`),
    availableForSale: required(node.availableForSale, `${path}.availableForSale`),
    price: mapMoney(node.priceRange?.minVariantPrice, `${path}.priceRange.minVariantPrice`),
    image: mapImage(node.featuredImage, `${path}.featuredImage`),
  }
}

/**
 * Maps a purchasable variant.
 *
 * @param wire - A variant node.
 * @param path - JSON path for error reporting.
 */
export function mapVariant(wire: WireVariant | null | undefined, path: string): ProductVariant {
  const node = required(wire, path)
  return {
    id: required(node.id, `${path}.id`),
    title: required(node.title, `${path}.title`),
    availableForSale: required(node.availableForSale, `${path}.availableForSale`),
    price: mapMoney(node.price, `${path}.price`),
  }
}
