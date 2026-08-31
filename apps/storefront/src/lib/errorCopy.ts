import { isRetryable, type StorefrontError } from '@sentra/sdk-commerce'

/**
 * Reader-facing detail for one failure: either a catalogue key this
 * application owns, or text that must be shown exactly as received.
 *
 * The distinction is a type rather than a convention because exactly one
 * taxonomy member — `graphql_user` — carries text we must not translate, and a
 * call site that forgot which one would produce either a raw key on screen or a
 * lost shopper-facing message. The compiler settles it instead.
 */
export type ErrorDetail =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'literal'; readonly text: string }

/** Catalogue keys for one failure, before translation. */
export interface ErrorCopy {
  /** Catalogue key for the short heading. Always ours to translate. */
  readonly titleKey: string
  /** The explanation: ours to translate, or the store's own words verbatim. */
  readonly detail: ErrorDetail
  /** Whether to offer a retry affordance. */
  readonly retryable: boolean
}

/** Reader-facing text for one failure, after translation. */
export interface ResolvedErrorCopy {
  readonly title: string
  readonly detail: string
  readonly retryable: boolean
}

/**
 * Maps the error taxonomy to reader-facing copy.
 *
 * Branching on `kind` rather than on message text is the whole reason the SDK
 * returns a discriminated union: the copy stays stable when Shopify rewords a
 * message, and adding a taxonomy member makes this switch fail to compile
 * rather than silently falling through to a generic apology.
 *
 * A `schema` failure deliberately shows nothing technical. The reader cannot
 * act on `$.product.title was null`; leaking it only advertises internals. The
 * detail belongs in the `storefront_error` analytics event and the console.
 *
 * @param error - The failure to describe.
 */
export function errorCopy(error: StorefrontError): ErrorCopy {
  const retryable = isRetryable(error)
  switch (error.kind) {
    case 'network':
      return {
        titleKey: 'storefront.error.network.title',
        detail: { kind: 'key', key: 'storefront.error.network.detail' },
        retryable,
      }
    case 'throttled':
      return {
        titleKey: 'storefront.error.throttled.title',
        detail: { kind: 'key', key: 'storefront.error.throttled.detail' },
        retryable,
      }
    case 'graphql_user':
      return {
        titleKey: 'storefront.error.declined.title',
        /* Shopify's userError text is written for shoppers ("Only 2 left in
           stock") and is the most useful thing we can show. */
        detail: { kind: 'literal', text: error.message },
        retryable,
      }
    case 'schema':
      return {
        titleKey: 'storefront.error.schema.title',
        detail: { kind: 'key', key: 'storefront.error.schema.detail' },
        retryable,
      }
  }
}

/**
 * Translates {@link errorCopy}'s keys for display.
 *
 * `t` is typed structurally rather than as `I18nSource['t']` so this stays
 * unit-testable without constructing an i18n instance — and so a caller can
 * pass the `t` it already destructured from `useI18n()` without ceremony.
 *
 * @param t - Translates one catalogue key.
 * @param error - The failure to describe.
 */
export function resolveErrorCopy(
  t: (key: string) => string,
  error: StorefrontError,
): ResolvedErrorCopy {
  const copy = errorCopy(error)
  return {
    title: t(copy.titleKey),
    detail: copy.detail.kind === 'key' ? t(copy.detail.key) : copy.detail.text,
    retryable: copy.retryable,
  }
}
