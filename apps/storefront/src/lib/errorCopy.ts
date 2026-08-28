import { isRetryable, type StorefrontError } from '@sentra/sdk-commerce'

/** Reader-facing text for one failure. */
export interface ErrorCopy {
  /** Short heading. */
  readonly title: string
  /** One sentence explaining what to do. */
  readonly detail: string
  /** Whether to offer a retry affordance. */
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
        title: "We couldn't reach the store",
        detail: 'Check your connection and try again.',
        retryable,
      }
    case 'throttled':
      return {
        title: 'The store is busy',
        detail: 'Too many requests just now — the store is busy. Try again in a moment.',
        retryable,
      }
    case 'graphql_user':
      return {
        title: 'That request was declined',
        /* Shopify's userError text is written for shoppers ("Only 2 left in
           stock") and is the most useful thing we can show. */
        detail: error.message,
        retryable,
      }
    case 'schema':
      return {
        title: 'Something went wrong on our side',
        detail: 'We have logged the problem. Please try again later.',
        retryable,
      }
  }
}
