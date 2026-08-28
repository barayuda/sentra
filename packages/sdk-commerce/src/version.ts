/**
 * Plain JSON import, deliberately without an `with { type: 'json' }` import
 * attribute. Every consumer of this module goes through Vite or Vitest, both of
 * which resolve bare JSON imports natively via `resolveJsonModule`; the
 * attribute form is what raw Node ESM requires, and nothing here is run as raw
 * Node ESM. Keeping the plain form avoids a transform-compatibility variable in
 * exchange for nothing.
 */
import provenance from '../schema/PROVENANCE.json'

/**
 * The Storefront API version this SDK speaks, read from the vendored schema's
 * provenance record rather than typed in by hand.
 *
 * Deriving it means the request URL and the generated types can never
 * disagree: re-vendoring a newer schema moves both at once, and the diff on
 * `PROVENANCE.json` makes the move visible in review.
 */
export const STOREFRONT_API_VERSION: string = provenance.storefrontApiVersion

/** SHA-256 of the vendored schema, for the supply-chain audit trail. */
export const STOREFRONT_SCHEMA_SHA256: string = provenance.sha256
