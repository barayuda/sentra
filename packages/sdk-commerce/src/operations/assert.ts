import { schemaError, type StorefrontResult } from '../errors.ts'
import { err, ok } from '../result.ts'

/**
 * Thrown by a mapping function when the response contradicts the generated
 * types. Never escapes the operations layer: {@link mapResult} converts it into
 * a `schema` error so callers still receive a `Result` rather than an exception.
 */
export class SchemaViolation extends Error {
  /** JSON path to the offending value. */
  readonly path: string

  constructor(path: string) {
    super(`Storefront response missing or invalid value at ${path}`)
    this.name = 'SchemaViolation'
    this.path = path
  }
}

/**
 * Asserts a value the generated types declare non-nullable is actually present.
 *
 * Checks `null`/`undefined` specifically rather than truthiness, because `0`,
 * `''` and `false` are all legitimate Storefront values — a truthiness check
 * here would reject a genuinely free product or an empty title.
 *
 * @param value - The value to check.
 * @param path - JSON path used in the error, e.g. `$.product.handle`.
 * @throws SchemaViolation when the value is null or undefined.
 */
export function required<T>(value: T | null | undefined, path: string): T {
  if (value === null || value === undefined) throw new SchemaViolation(path)
  return value
}

/**
 * Applies a mapping function to a successful result, converting any
 * {@link SchemaViolation} it throws into a `schema` error.
 *
 * This is the seam that lets mapping code read like ordinary straight-line
 * property access — `required(node.title, '$.title')` — while still returning
 * typed failures. Errors that are not `SchemaViolation` propagate deliberately:
 * a `TypeError` in a mapper is a bug in this package, and swallowing it into a
 * `schema` error would blame Shopify for our own defect.
 *
 * @param result - The transport's result.
 * @param map - Wire-to-domain mapping.
 */
export function mapResult<TWire, TDomain>(
  result: StorefrontResult<TWire>,
  map: (wire: TWire) => TDomain,
): StorefrontResult<TDomain> {
  if (!result.ok) return result
  try {
    return ok(map(result.value))
  } catch (error) {
    if (error instanceof SchemaViolation) return err(schemaError(error.message, error.path))
    throw error
  }
}
