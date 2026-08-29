/**
 * An operation outcome that cannot be ignored by accident.
 *
 * The SDK returns results instead of throwing because its failures are
 * ordinary, expected states — a throttled request, a rejected cart line — not
 * exceptional ones. A thrown error can be forgotten in a `try` nobody wrote;
 * a `Result` cannot be read without first checking `ok`, so the compiler makes
 * every call site acknowledge the failure path.
 *
 * @typeParam T - The success value.
 * @typeParam E - The failure value.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

/**
 * Wraps a success value.
 *
 * @param value - The value to carry.
 */
export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value }
}

/**
 * Wraps a failure value.
 *
 * @param error - The error to carry.
 */
export function err<E, T = never>(error: E): Result<T, E> {
  return { ok: false, error }
}
