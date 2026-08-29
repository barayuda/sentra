import {
  graphqlUserError,
  schemaError,
  type StorefrontError,
  type StorefrontResult,
} from '../errors.ts'
import {
  CartCreateDocument,
  CartGetDocument,
  CartLinesAddDocument,
  CartLinesRemoveDocument,
  CartLinesUpdateDocument,
} from '../generated/graphql.ts'
import type {
  CartCreateMutation,
  CartGetQuery,
  CartLinesAddMutation,
  CartLinesRemoveMutation,
  CartLinesUpdateMutation,
} from '../generated/graphql.ts'
import { err, ok } from '../result.ts'
import type { StorefrontTransport } from '../transport.ts'
import type { Cart, CartLine } from '../types.ts'
import { SchemaViolation, mapResult, required } from './assert.ts'
import { mapImage, mapMoney, requiredString } from './mapping.ts'

/** A line to add to a cart. */
export interface CartLineInput {
  /** Variant id (Shopify calls it merchandise). */
  readonly merchandiseId: string
  readonly quantity: number
}

/** A quantity change to an existing line. */
export interface CartLineUpdate {
  /** Cart line id, not the variant id. */
  readonly id: string
  readonly quantity: number
}

/**
 * Narrow view of the `CartFields` fragment.
 *
 * Described structurally rather than imported from the generated `…Mutation`
 * types, for the same reason as the wire interfaces in `mapping.ts`: each
 * generated type describes one whole operation's response, so a mapper shared
 * by six operations cannot be typed against any one of them without picking
 * arbitrarily. Codegen already proved these fields exist by validating the
 * documents against the vendored schema, so this narrows rather than
 * re-declares.
 *
 * Typed as a parameter rather than taken as `unknown` and cast: a cast would
 * discard the compile-time drift check this package depends on. If a
 * regenerated schema changes a field's shape, the call sites below fail to
 * typecheck — which is exactly the signal we want, and the whole reason
 * `SchemaError` is a runtime last resort rather than a first line of defence.
 */
interface WireCart {
  readonly id?: string | null
  readonly checkoutUrl?: unknown
  readonly totalQuantity?: number | null
  readonly cost?: {
    readonly subtotalAmount?: {
      readonly amount?: unknown
      readonly currencyCode?: string | null
    } | null
  } | null
  readonly lines?: {
    readonly edges?: readonly ({
      readonly node?: {
        readonly id?: string | null
        readonly quantity?: number | null
        readonly merchandise?: {
          readonly id?: string | null
          readonly title?: string | null
          readonly price?: {
            readonly amount?: unknown
            readonly currencyCode?: string | null
          } | null
          readonly image?: {
            readonly url?: unknown
            readonly altText?: string | null
            readonly width?: number | null
            readonly height?: number | null
          } | null
          readonly product?: {
            readonly title?: string | null
            readonly handle?: string | null
          } | null
        } | null
      } | null
    } | null)[]
  } | null
}

/** Maps one cart line. */
function mapCartLine(
  node: NonNullable<NonNullable<NonNullable<WireCart['lines']>['edges']>[number]>['node'],
  path: string,
): CartLine {
  const line = required(node, path)
  const merchandise = required(line.merchandise, `${path}.merchandise`)
  const product = required(merchandise.product, `${path}.merchandise.product`)
  return {
    id: required(line.id, `${path}.id`),
    quantity: required(line.quantity, `${path}.quantity`),
    merchandiseId: required(merchandise.id, `${path}.merchandise.id`),
    productTitle: required(product.title, `${path}.merchandise.product.title`),
    productHandle: required(product.handle, `${path}.merchandise.product.handle`),
    variantTitle: required(merchandise.title, `${path}.merchandise.title`),
    price: mapMoney(merchandise.price, `${path}.merchandise.price`),
    image: mapImage(merchandise.image, `${path}.merchandise.image`),
  }
}

/**
 * Maps the cart fragment into the domain shape.
 *
 * @param wire - The `cart` object from any cart query or mutation.
 * @param path - JSON path for error reporting.
 * @throws SchemaViolation when a required field is absent.
 */
function mapCart(wire: WireCart | null | undefined, path: string): Cart {
  const cart = required(wire, path)
  const edges = required(cart.lines?.edges, `${path}.lines.edges`)
  return {
    id: required(cart.id, `${path}.id`),
    checkoutUrl: requiredString(cart.checkoutUrl, `${path}.checkoutUrl`),
    totalQuantity: required(cart.totalQuantity, `${path}.totalQuantity`),
    subtotal: mapMoney(cart.cost?.subtotalAmount, `${path}.cost.subtotalAmount`),
    lines: edges.map((edge, index) =>
      mapCartLine(edge?.node, `${path}.lines.edges[${index}].node`),
    ),
  }
}

/**
 * Internal signal for a `userErrors` rejection, mirroring how
 * {@link SchemaViolation} lets mapping code stay straight-line. Never escapes
 * this module: {@link mapCartResult} converts it into a `graphql_user` error.
 *
 * Declared above its first use because `instanceof` needs the binding
 * initialised, and class declarations are not hoisted the way functions are.
 */
class CartRejected extends Error {
  readonly userErrors: readonly {
    field: readonly string[] | null
    message: string
    code: string | null
  }[]

  constructor(
    userErrors: readonly {
      field: readonly string[] | null
      message: string
      code: string | null
    }[],
  ) {
    super('cart mutation rejected')
    this.name = 'CartRejected'
    this.userErrors = userErrors
  }
}

/** Shape shared by every cart mutation's payload. */
interface MutationPayload {
  readonly cart?: WireCart | null
  readonly userErrors?:
    | readonly {
        readonly field?: readonly string[] | null
        readonly message?: string | null
        readonly code?: string | null
      }[]
    | null
}

/**
 * Converts a mutation payload into a result.
 *
 * `userErrors` is checked **before** `cart`, and that order is the whole point.
 * Shopify answers a rejected mutation with HTTP 200, no GraphQL errors, the
 * cart unchanged, and the reason in `userErrors` — so a client that reads
 * `cart` first reports success while the user's action silently vanishes.
 *
 * @param payload - The mutation's payload object.
 * @param path - JSON path for error reporting.
 */
function resolveMutation(payload: MutationPayload | null | undefined, path: string): Cart {
  const result = required(payload, path)
  const userErrors = result.userErrors ?? []
  if (userErrors.length > 0) {
    throw new CartRejected(
      userErrors.map((userError) => ({
        field: userError.field ?? null,
        message: userError.message ?? 'The Storefront API rejected the request',
        code: userError.code ?? null,
      })),
    )
  }
  return mapCart(result.cart, `${path}.cart`)
}

/**
 * Like {@link mapResult}, but also converts {@link CartRejected} into a
 * `graphql_user` error.
 *
 * A non-`CartRejected`, non-`SchemaViolation` error propagates deliberately: a
 * `TypeError` here is a defect in this module, and converting it into a
 * Storefront error would blame Shopify for our own bug.
 *
 * @param result - The transport's result.
 * @param map - Payload-to-cart mapping.
 */
function mapCartResult<TWire>(
  result: StorefrontResult<TWire>,
  map: (wire: TWire) => Cart,
): StorefrontResult<Cart> {
  if (!result.ok) return result
  try {
    return ok(map(result.value))
  } catch (error) {
    if (error instanceof CartRejected) {
      return err<StorefrontError, Cart>(graphqlUserError(error.userErrors))
    }
    if (error instanceof SchemaViolation) {
      return err<StorefrontError, Cart>(schemaError(error.message, error.path))
    }
    throw error
  }
}

/**
 * Creates a cart, optionally pre-filled.
 *
 * @param transport - The transport to send through.
 * @param input - Initial lines; an empty cart when omitted.
 */
export async function createCart(
  transport: StorefrontTransport,
  input: { readonly lines?: readonly CartLineInput[] },
): Promise<StorefrontResult<Cart>> {
  const response = await transport.request<CartCreateMutation>(String(CartCreateDocument), {
    lines: input.lines ?? [],
  })
  return mapCartResult(response, (data) => resolveMutation(data.cartCreate, '$.cartCreate'))
}

/**
 * Fetches a cart by id.
 *
 * Resolves to `null` for an unknown or expired id: Shopify carts expire, so a
 * stale id recovered from storage is an ordinary event the caller handles by
 * creating a new cart — not a failure worth surfacing to the user.
 *
 * @param transport - The transport to send through.
 * @param input - The cart id.
 */
export async function getCart(
  transport: StorefrontTransport,
  input: { readonly cartId: string },
): Promise<StorefrontResult<Cart | null>> {
  const response = await transport.request<CartGetQuery>(String(CartGetDocument), {
    cartId: input.cartId,
  })
  return mapResult(response, (data) => (data.cart ? mapCart(data.cart, '$.cart') : null))
}

/**
 * Adds lines to a cart.
 *
 * @param transport - The transport to send through.
 * @param input - Cart id and the lines to add.
 */
export async function addCartLines(
  transport: StorefrontTransport,
  input: { readonly cartId: string; readonly lines: readonly CartLineInput[] },
): Promise<StorefrontResult<Cart>> {
  const response = await transport.request<CartLinesAddMutation>(String(CartLinesAddDocument), {
    cartId: input.cartId,
    lines: input.lines,
  })
  return mapCartResult(response, (data) => resolveMutation(data.cartLinesAdd, '$.cartLinesAdd'))
}

/**
 * Changes line quantities.
 *
 * @param transport - The transport to send through.
 * @param input - Cart id and the line updates.
 */
export async function updateCartLines(
  transport: StorefrontTransport,
  input: { readonly cartId: string; readonly lines: readonly CartLineUpdate[] },
): Promise<StorefrontResult<Cart>> {
  const response = await transport.request<CartLinesUpdateMutation>(
    String(CartLinesUpdateDocument),
    {
      cartId: input.cartId,
      lines: input.lines,
    },
  )
  return mapCartResult(response, (data) =>
    resolveMutation(data.cartLinesUpdate, '$.cartLinesUpdate'),
  )
}

/**
 * Removes lines from a cart.
 *
 * @param transport - The transport to send through.
 * @param input - Cart id and the line ids to remove.
 */
export async function removeCartLines(
  transport: StorefrontTransport,
  input: { readonly cartId: string; readonly lineIds: readonly string[] },
): Promise<StorefrontResult<Cart>> {
  const response = await transport.request<CartLinesRemoveMutation>(
    String(CartLinesRemoveDocument),
    {
      cartId: input.cartId,
      lineIds: input.lineIds,
    },
  )
  return mapCartResult(response, (data) =>
    resolveMutation(data.cartLinesRemove, '$.cartLinesRemove'),
  )
}
