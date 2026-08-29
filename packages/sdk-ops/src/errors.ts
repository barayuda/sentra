import type { Result } from '@sentra/result'

/**
 * Every way an Ops API request can fail, as a discriminated union.
 *
 * The same *convention* as `@sentra/sdk-commerce` — branch on `kind`, never
 * on message text — with entirely different arms, because the failure modes
 * of a REST service with bearer auth are not the failure modes of Shopify's
 * cost-throttled GraphQL. Sharing the shape while not sharing the members is
 * the point: a convention travels, a taxonomy does not. See ADR 0006.
 *
 * - `network` — no usable response arrived, or the server itself failed.
 * - `auth` — the token was missing, rejected, or insufficient (401/403).
 * - `validation` — the server understood the request and rejected the input
 *   on business grounds, naming the field. Never retryable.
 * - `schema` — the response did not match the declared types, meaning the
 *   service drifted from what this SDK was written against.
 */
export type OpsError =
  | { readonly kind: 'network'; readonly message: string; readonly status: number | null }
  | { readonly kind: 'auth'; readonly message: string }
  | { readonly kind: 'validation'; readonly message: string; readonly field: string }
  | { readonly kind: 'schema'; readonly message: string; readonly path: string }

/** An Ops operation's outcome. */
export type OpsResult<T> = Result<T, OpsError>

/**
 * Builds a `network` error.
 *
 * @param message - What went wrong, in transport terms.
 * @param status - HTTP status, or null when no response arrived.
 */
export function networkError(message: string, status: number | null): OpsError {
  return { kind: 'network', message, status }
}

/**
 * Builds an `auth` error.
 *
 * @param message - Why the request was refused. Never include the token.
 */
export function authError(message: string): OpsError {
  return { kind: 'auth', message }
}

/**
 * Builds a `validation` error.
 *
 * @param message - The server's explanation.
 * @param field - Which input field was wrong, so a form can attach it.
 */
export function validationError(message: string, field: string): OpsError {
  return { kind: 'validation', message, field }
}

/**
 * Builds a `schema` error.
 *
 * @param message - What did not match.
 * @param path - JSON path into the response, e.g. `$.orders[0].id`.
 */
export function schemaError(message: string, path: string): OpsError {
  return { kind: 'schema', message, path }
}

/**
 * Whether retrying the identical request could plausibly succeed.
 *
 * The switch has no `default`. With `OpsError` a closed union, adding a fifth
 * arm makes this function fail to typecheck — which is the intended alarm.
 * A `default: return false` would instead silently classify the new arm.
 *
 * @param error - The error to classify.
 */
export function isRetryable(error: OpsError): boolean {
  switch (error.kind) {
    case 'network':
      return error.status === null || error.status >= 500
    case 'auth':
    case 'validation':
    case 'schema':
      return false
  }
}
