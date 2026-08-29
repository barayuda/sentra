import { err, ok, type Result } from '@sentra/result'
import { schemaError, type OpsError } from '../errors.ts'

/**
 * Thrown internally when a response omits a field the types declare.
 *
 * A class rather than a returned error because it is thrown from deep inside
 * a mapping function and caught once at the operation boundary, where it
 * becomes a `schema` error. Threading a `Result` through every field access
 * would make the mapping unreadable for no gain.
 */
export class SchemaViolation extends Error {
  /** JSON path to the offending value. */
  readonly path: string

  /**
   * @param message - What was wrong.
   * @param path - JSON path to the offending value.
   */
  constructor(message: string, path: string) {
    super(message)
    this.name = 'SchemaViolation'
    this.path = path
  }
}

/**
 * Asserts a value is present.
 *
 * @param value - The value read from the response.
 * @param path - JSON path, for the error message.
 */
export function required<T>(value: T | null | undefined, path: string): T {
  if (value === null || value === undefined) {
    throw new SchemaViolation(`expected a value at ${path}`, path)
  }
  return value
}

/**
 * Asserts a value is a string.
 *
 * Hand-rolled rather than derived from a schema: the response is `unknown`
 * at runtime no matter what the types say, and a cast asserts a fact nobody
 * checked.
 *
 * @param value - The value read from the response.
 * @param path - JSON path, for the error message.
 */
export function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new SchemaViolation(`expected a string at ${path}, got ${typeof value}`, path)
  }
  return value
}

/**
 * Asserts a value is a finite number.
 *
 * @param value - The value read from the response.
 * @param path - JSON path, for the error message.
 */
export function requiredNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SchemaViolation(`expected a number at ${path}`, path)
  }
  return value
}

/**
 * Runs a mapping function over a successful result, converting any
 * {@link SchemaViolation} it throws into a `schema` error.
 *
 * @param result - The transport's outcome.
 * @param map - Maps the wire shape to the domain shape.
 */
export function mapResult<TWire, TDomain>(
  result: Result<TWire, OpsError>,
  map: (wire: TWire) => TDomain,
): Result<TDomain, OpsError> {
  if (!result.ok) return err(result.error)
  try {
    return ok(map(result.value))
  } catch (cause) {
    if (cause instanceof SchemaViolation) return err(schemaError(cause.message, cause.path))
    throw cause
  }
}
