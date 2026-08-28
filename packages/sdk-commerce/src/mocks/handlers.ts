import { HttpResponse, delay, http, type RequestHandler } from 'msw'
import { FIXTURE_COLLECTION, FIXTURE_PRODUCTS, type WireProduct } from './fixtures.ts'
import {
  addMockLines,
  createMockCart,
  findMockCart,
  removeMockLines,
  toWireCart,
  updateMockLines,
} from './store.ts'

/**
 * MSW handlers for the Storefront API.
 *
 * Deliberately built on `http.post` rather than MSW's `graphql` helpers. The
 * helpers match on operation name and return a `data` payload, but the SDK's
 * behaviour under load depends on `extensions.cost` and Shopify's throttling
 * responses — which the helpers do not model. Owning the raw response is what
 * lets the same fixtures drive both the happy path and every branch of the
 * error taxonomy.
 */

/** Which behaviour the handlers should exhibit. */
export type MockScenario = 'ok' | 'throttled' | 'network' | 'user_error' | 'schema_drift'

/** Mutable knob shared with whoever installed the handlers. */
export interface MockControl {
  /** Current behaviour. */
  scenario: MockScenario
  /** Artificial latency in milliseconds, for exercising loading states. */
  latencyMs: number
}

/** Creates a control object defaulting to the happy path. */
export function createMockControl(): MockControl {
  return { scenario: 'ok', latencyMs: 0 }
}

/** Any Storefront GraphQL endpoint, whatever the shop domain or API version. */
const STOREFRONT_ENDPOINT = /\/api\/\d{4}-\d{2}\/graphql\.json$/

/** Cost accounting shape shared by every successful mock response. */
interface CostExtensions {
  readonly cost: {
    readonly requestedQueryCost: number
    readonly actualQueryCost: number
    readonly throttleStatus: {
      readonly maximumAvailable: number
      readonly currentlyAvailable: number
      readonly restoreRate: number
    }
  }
}

/** Plausible cost accounting for a successful response. */
function okCost(requestedQueryCost: number): CostExtensions {
  return {
    cost: {
      requestedQueryCost,
      actualQueryCost: requestedQueryCost,
      throttleStatus: {
        maximumAvailable: 1000,
        currentlyAvailable: 1000 - requestedQueryCost,
        restoreRate: 50,
      },
    },
  }
}

/**
 * The throttled response Shopify sends when the cost budget is exhausted.
 *
 * No explicit return type: `HttpResponse` is generic over its body shape, and
 * inference from `HttpResponse.json(...)` names that shape more precisely
 * than a hand-written annotation would.
 */
function throttledResponse() {
  return HttpResponse.json(
    {
      errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
      extensions: {
        cost: {
          requestedQueryCost: 300,
          actualQueryCost: null,
          throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 0, restoreRate: 50 },
        },
      },
    },
    { status: 200 },
  )
}

/** A `userErrors` payload for the mutation named by `key`. See {@link throttledResponse} for why the return type is inferred. */
function userErrorResponse(key: string) {
  return HttpResponse.json({
    data: {
      [key]: {
        cart: null,
        userErrors: [
          {
            field: ['lines', '0', 'quantity'],
            message: 'The quantity requested exceeds available inventory',
            code: 'INVALID',
          },
        ],
      },
    },
    extensions: okCost(12),
  })
}

/** Extracts the operation name from a document string. */
function operationNameOf(document: string): string {
  return /(?:query|mutation)\s+(\w+)/.exec(document)?.[1] ?? ''
}

/** Wire product node without the detail-only fields — the `ProductSummaryFields` shape. */
function toSummaryNode(product: WireProduct) {
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    availableForSale: product.availableForSale,
    featuredImage: product.featuredImage,
    priceRange: product.priceRange,
  }
}

interface GraphQLRequestBody {
  readonly query?: string
  readonly variables?: Record<string, unknown>
}

/**
 * Builds handlers bound to a control object.
 *
 * @param control - Scenario switch; a fresh happy-path control when omitted.
 */
export function createStorefrontHandlers(
  control: MockControl = createMockControl(),
): RequestHandler[] {
  return [
    http.post(STOREFRONT_ENDPOINT, async ({ request }) => {
      if (control.latencyMs > 0) await delay(control.latencyMs)
      if (control.scenario === 'network') return HttpResponse.error()
      if (control.scenario === 'throttled') return throttledResponse()

      const body = (await request.json()) as GraphQLRequestBody
      const operation = operationNameOf(body.query ?? '')
      const variables = body.variables ?? {}

      switch (operation) {
        case 'CollectionPage': {
          const first = Number(variables.first ?? 8)
          const after = typeof variables.after === 'string' ? variables.after : null
          /* Cursors are opaque to clients, so an index encoded as a string is a
             faithful stand-in for Shopify's base64 cursors. */
          const start = after === null ? 0 : Number(after.replace('cursor-', ''))
          const slice = FIXTURE_PRODUCTS.slice(start, start + first)
          const end = start + slice.length
          return HttpResponse.json({
            data: {
              collection: {
                handle: FIXTURE_COLLECTION.handle,
                title: FIXTURE_COLLECTION.title,
                products: {
                  pageInfo: {
                    hasNextPage: end < FIXTURE_PRODUCTS.length,
                    endCursor: end < FIXTURE_PRODUCTS.length ? `cursor-${end}` : null,
                  },
                  edges: slice.map((product) => ({ node: toSummaryNode(product) })),
                },
              },
            },
            extensions: okCost(slice.length + 4),
          })
        }

        case 'ProductDetail': {
          const handle = String(variables.handle ?? '')
          const product = FIXTURE_PRODUCTS.find((candidate) => candidate.handle === handle)
          if (!product) {
            return HttpResponse.json({ data: { product: null }, extensions: okCost(6) })
          }
          if (control.scenario === 'schema_drift') {
            /* Drop a field the generated types declare non-nullable — exactly
               what a live schema change looks like from the client's side. */
            return HttpResponse.json({
              data: { product: { ...product, title: null } },
              extensions: okCost(6),
            })
          }
          return HttpResponse.json({ data: { product }, extensions: okCost(6) })
        }

        case 'CartCreate': {
          if (control.scenario === 'user_error') return userErrorResponse('cartCreate')
          const lines = (variables.lines ?? []) as { merchandiseId: string; quantity: number }[]
          const cart = createMockCart(lines)
          return HttpResponse.json({
            data: { cartCreate: { cart: toWireCart(cart), userErrors: [] } },
            extensions: okCost(10),
          })
        }

        case 'CartGet': {
          const cart = findMockCart(String(variables.cartId ?? ''))
          return HttpResponse.json({
            data: { cart: cart ? toWireCart(cart) : null },
            extensions: okCost(8),
          })
        }

        case 'CartLinesAdd': {
          if (control.scenario === 'user_error') return userErrorResponse('cartLinesAdd')
          const cart = addMockLines(
            String(variables.cartId ?? ''),
            (variables.lines ?? []) as { merchandiseId: string; quantity: number }[],
          )
          return HttpResponse.json({
            data: { cartLinesAdd: { cart: cart ? toWireCart(cart) : null, userErrors: [] } },
            extensions: okCost(10),
          })
        }

        case 'CartLinesUpdate': {
          if (control.scenario === 'user_error') return userErrorResponse('cartLinesUpdate')
          const cart = updateMockLines(
            String(variables.cartId ?? ''),
            (variables.lines ?? []) as { id: string; quantity: number }[],
          )
          return HttpResponse.json({
            data: { cartLinesUpdate: { cart: cart ? toWireCart(cart) : null, userErrors: [] } },
            extensions: okCost(10),
          })
        }

        case 'CartLinesRemove': {
          if (control.scenario === 'user_error') return userErrorResponse('cartLinesRemove')
          const cart = removeMockLines(
            String(variables.cartId ?? ''),
            (variables.lineIds ?? []) as string[],
          )
          return HttpResponse.json({
            data: { cartLinesRemove: { cart: cart ? toWireCart(cart) : null, userErrors: [] } },
            extensions: okCost(10),
          })
        }

        default:
          /* An unrecognised operation is a bug in this file, not a Shopify
             response — report it the way Shopify reports an unknown field. */
          return HttpResponse.json({
            errors: [{ message: `Mock handler has no case for operation "${operation}"` }],
          })
      }
    }),
  ]
}
