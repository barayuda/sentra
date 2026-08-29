/**
 * The outcome of an operation that is expected to fail sometimes.
 *
 * A discriminated union rather than a thrown exception, because a thrown
 * error is invisible to the type system: nothing forces a caller to handle
 * it, and nothing tells them what shapes it can take. Branching on `ok`
 * makes both mandatory.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

/**
 * Wraps a success.
 *
 * @param value - The produced value.
 */
export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value }
}

/**
 * Wraps a failure.
 *
 * @param error - The failure, in whatever shape the domain defines.
 */
export function err<E, T = never>(error: E): Result<T, E> {
  return { ok: false, error }
}

/**
 * Type guard for the success branch.
 *
 * Exists so that `results.filter(isOk)` narrows the array element type. A
 * arrow predicate written inline does not, because TypeScript only applies
 * the narrowing overload of `filter` to a declared type predicate.
 *
 * @param result - The result to test.
 */
export function isOk<T, E>(
  result: Result<T, E>,
): result is { readonly ok: true; readonly value: T } {
  return result.ok
}

/**
 * Type guard for the failure branch. See {@link isOk}.
 *
 * @param result - The result to test.
 */
export function isErr<T, E>(
  result: Result<T, E>,
): result is { readonly ok: false; readonly error: E } {
  return !result.ok
}
