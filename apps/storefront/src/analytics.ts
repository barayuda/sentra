import {
  batchTransport,
  consoleTransport,
  type EventSchema,
  type Transport,
} from '@sentra/plugin-analytics'

/**
 * The application's analytics allowlist.
 *
 * The allowlist IS the privacy control: `createAnalytics` strips any property
 * not named here before a transport ever sees it, so widening this object is
 * the only way to start sending a new field — a reviewable, deliberate act.
 *
 * What is deliberately absent: product titles and descriptions (merchant
 * content, unbounded, not ours to forward), any search text, and any customer
 * identifier. A handle or a variant id identifies a product for analysis
 * without carrying its copy.
 */
export const storefrontEventSchema = {
  /** Sent by `instrumentRouter`; `path` excludes the query string by design. */
  page_view: ['path', 'name'],
  /** Sent by `captureWebVitals`. */
  web_vital: ['metric', 'value', 'rating'],
  product_view: ['handle', 'available'],
  add_to_cart: ['merchandiseId', 'quantity', 'currency', 'value'],
  remove_from_cart: ['lineId', 'quantity'],
  cart_open: ['itemCount'],
  /**
   * Failure telemetry keyed on the error taxonomy's `kind`, never on a message.
   * Messages are Shopify's to change and can echo request content; `kind` plus
   * the operation name is enough to alert on.
   */
  storefront_error: ['kind', 'operation'],
} as const satisfies EventSchema

/**
 * Builds the transport for this build.
 *
 * Batched over a console sink: batching is the behaviour worth demonstrating
 * (one flush per page-hide instead of a request per interaction), while the
 * console sink keeps the demo dependency-free and makes the payload inspectable
 * live. A real deployment swaps the inner transport for `beaconTransport(url)`
 * without touching a call site.
 */
export function createStorefrontAnalyticsTransport(): Transport {
  return batchTransport(consoleTransport(), { maxSize: 20, flushMs: 5000 })
}
