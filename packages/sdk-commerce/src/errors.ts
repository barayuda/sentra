import type { Result } from './result.ts'

/**
 * Shopify's remaining query-cost budget, as reported in `extensions.cost`.
 *
 * The Storefront API rate-limits by **query cost**, not request count: a
 * request's cost is computed from the shape of the query, and a leaky-bucket
 * budget refills at `restoreRate` points per second. This is why the SDK
 * surfaces the numbers instead of a bare "rate limited" flag — a caller can
 * only decide between backing off and degrading the query if it knows the size
 * of the deficit.
 */
export interface ThrottleStatus {
  /** Bucket capacity in cost points. */
  readonly maximumAvailable: number
  /** Points available right now. */
  readonly currentlyAvailable: number
  /** Points restored per second. */
  readonly restoreRate: number
}

/** Cost accounting for a single request. */
export interface RequestCost {
  /** Cost Shopify computed from the query shape before executing it. */
  readonly requestedQueryCost: number
  /** Cost actually consumed; null when Shopify omitted it. */
  readonly actualQueryCost: number | null
  /** Budget state after the request; null when Shopify omitted it. */
  readonly throttleStatus: ThrottleStatus | null
}

/** One entry from a mutation's `userErrors` payload. */
export interface StorefrontUserError {
  /** Path to the offending input field, or null for a whole-request error. */
  readonly field: readonly string[] | null
  /** Shopify's human-readable message. */
  readonly message: string
  /** Shopify's machine-readable code, when present. */
  readonly code: string | null
}

/**
 * Every way a Storefront request can fail, as a discriminated union.
 *
 * Consumers branch on `kind`. That is the whole point: rendering a failure must
 * never require matching on message text, because message text is Shopify's to
 * change without warning.
 *
 * - `network` — the request never produced a usable HTTP response (DNS,
 *   connection reset, timeout) or produced a server-side failure.
 * - `throttled` — the cost budget is exhausted. Retryable, and the caller has
 *   the numbers needed to decide how long to wait.
 * - `graphql_user` — Shopify validated the request and rejected it on business
 *   grounds (`userErrors`). NOT retryable: the input is wrong.
 * - `schema` — the response did not match the generated types. Because the
 *   types come from a pinned, vendored schema, this means the live schema has
 *   drifted from the one we generated against — an operational signal, not a
 *   user-facing one.
 */
export type StorefrontError =
  | {
      readonly kind: 'network'
      readonly message: string
      readonly attempts: number
      readonly status: number | null
    }
  | {
      readonly kind: 'throttled'
      readonly message: string
      readonly attempts: number
      readonly throttleStatus: ThrottleStatus | null
    }
  | {
      readonly kind: 'graphql_user'
      readonly message: string
      readonly userErrors: readonly StorefrontUserError[]
    }
  | {
      readonly kind: 'schema'
      readonly message: string
      readonly path: string
    }

/** A Storefront operation's outcome. */
export type StorefrontResult<T> = Result<T, StorefrontError>

/**
 * Builds a `network` error.
 *
 * @param message - What went wrong, in transport terms.
 * @param attempts - How many attempts were made before giving up.
 * @param status - HTTP status, or null when no response arrived.
 */
export function networkError(
  message: string,
  attempts: number,
  status: number | null,
): StorefrontError {
  return { kind: 'network', message, attempts, status }
}

/**
 * Builds a `throttled` error.
 *
 * @param attempts - How many attempts were made before giving up.
 * @param throttleStatus - Budget state, when Shopify reported it.
 */
export function throttledError(
  attempts: number,
  throttleStatus: ThrottleStatus | null,
): StorefrontError {
  return {
    kind: 'throttled',
    message: `Storefront API throttled the request after ${attempts} attempts`,
    attempts,
    throttleStatus,
  }
}

/**
 * Builds a `graphql_user` error from a mutation's `userErrors` payload.
 *
 * The messages are joined into one summary for convenience, but the full
 * array is preserved so a form can attach each message to its own field.
 *
 * @param userErrors - Shopify's `userErrors` entries.
 */
export function graphqlUserError(
  userErrors: readonly StorefrontUserError[],
): Extract<StorefrontError, { kind: 'graphql_user' }> {
  const message =
    userErrors.length > 0
      ? userErrors.map((userError) => userError.message).join('; ')
      : 'The Storefront API rejected the request'
  return { kind: 'graphql_user', message, userErrors }
}

/**
 * Builds a `schema` error.
 *
 * @param message - What did not match.
 * @param path - JSON path into the response, e.g. `$.product.title`.
 */
export function schemaError(message: string, path: string): StorefrontError {
  return { kind: 'schema', message, path }
}

/**
 * Whether retrying the identical request could plausibly succeed.
 *
 * Retrying a `graphql_user` or `schema` failure cannot help — the input or the
 * contract is wrong, and repeating the call just spends budget. A `network`
 * failure retries only when no response arrived or the server itself failed;
 * a 4xx means the request was understood and refused.
 *
 * @param error - The error to classify.
 */
export function isRetryable(error: StorefrontError): boolean {
  switch (error.kind) {
    case 'throttled':
      return true
    case 'network':
      return error.status === null || error.status >= 500
    case 'graphql_user':
    case 'schema':
      return false
  }
}
