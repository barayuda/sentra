import {
  FIXTURE_VARIANT_INDEX,
  MOCK_CURRENCY,
  MOCK_SHOP_DOMAIN,
  type WireProduct,
} from './fixtures.ts'

/**
 * In-memory cart state for the mock handlers.
 *
 * Cart mutations are stateful, so mocking them with static payloads would let a
 * broken client pass: add-then-read has to actually reflect the add, or the
 * fixtures prove nothing about the store built on top of them.
 *
 * Reset between tests with {@link resetMockStore}.
 */

interface MockLine {
  id: string
  merchandiseId: string
  quantity: number
}

interface MockCart {
  id: string
  lines: MockLine[]
}

const carts = new Map<string, MockCart>()
let cartSequence = 0
let lineSequence = 0

/** Clears every cart and resets id sequences. */
export function resetMockStore(): void {
  carts.clear()
  cartSequence = 0
  lineSequence = 0
}

/** Creates a cart, optionally pre-filled. */
export function createMockCart(
  lines: readonly { merchandiseId: string; quantity: number }[],
): MockCart {
  cartSequence += 1
  const cart: MockCart = { id: `gid://shopify/Cart/mock-${cartSequence}`, lines: [] }
  carts.set(cart.id, cart)
  addMockLines(cart.id, lines)
  return cart
}

/** Looks up a cart, or null when the id is unknown. */
export function findMockCart(cartId: string): MockCart | null {
  return carts.get(cartId) ?? null
}

/**
 * Adds lines, merging quantities for a variant already present — which is what
 * Shopify does, and what a client that keys lines by variant expects.
 */
export function addMockLines(
  cartId: string,
  lines: readonly { merchandiseId: string; quantity: number }[],
): MockCart | null {
  const cart = carts.get(cartId)
  if (!cart) return null
  for (const line of lines) {
    const existing = cart.lines.find((candidate) => candidate.merchandiseId === line.merchandiseId)
    if (existing) {
      existing.quantity += line.quantity
      continue
    }
    lineSequence += 1
    cart.lines.push({
      id: `gid://shopify/CartLine/mock-${lineSequence}`,
      merchandiseId: line.merchandiseId,
      quantity: line.quantity,
    })
  }
  return cart
}

/** Sets line quantities; a quantity of zero removes the line. */
export function updateMockLines(
  cartId: string,
  updates: readonly { id: string; quantity: number }[],
): MockCart | null {
  const cart = carts.get(cartId)
  if (!cart) return null
  for (const update of updates) {
    const line = cart.lines.find((candidate) => candidate.id === update.id)
    if (!line) continue
    line.quantity = update.quantity
  }
  cart.lines = cart.lines.filter((line) => line.quantity > 0)
  return cart
}

/** Removes lines by id. */
export function removeMockLines(cartId: string, lineIds: readonly string[]): MockCart | null {
  const cart = carts.get(cartId)
  if (!cart) return null
  cart.lines = cart.lines.filter((line) => !lineIds.includes(line.id))
  return cart
}

/** Formats a cent total as a Shopify decimal string. */
function toDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** Parses a Shopify decimal string into cents, avoiding float drift. */
function toCents(amount: string): number {
  return Math.round(Number(amount) * 100)
}

/** Builds the wire `Cart` payload for a mock cart. */
export function toWireCart(cart: MockCart): unknown {
  /**
   * Lines whose variant still resolves, and the single source for all three
   * totals below.
   *
   * Computing `lines`, `subtotal` and `totalQuantity` from separate passes let
   * them disagree: an unresolvable variant was dropped from two of them and
   * counted in the third, so a cart could report a nonzero item count with an
   * empty line list. Deriving all three from one filtered list makes that
   * inconsistency unrepresentable rather than merely untested.
   */
  const resolved = cart.lines.flatMap((line) => {
    const product: WireProduct | undefined = FIXTURE_VARIANT_INDEX.get(line.merchandiseId)
    const variant = product?.variants.edges.find((edge) => edge.node.id === line.merchandiseId)
    /* An unknown variant is dropped rather than faked: a cart line pointing at
       a product that does not exist is exactly the schema-error case, and
       inventing data here would hide it. */
    if (!product || !variant) return []
    return [{ line, product, variant }]
  })

  const subtotalCents = resolved.reduce(
    (total, { line, variant }) => total + toCents(variant.node.price.amount) * line.quantity,
    0,
  )

  return {
    id: cart.id,
    checkoutUrl: `https://${MOCK_SHOP_DOMAIN}/cart/c/${cart.id.split('/').pop() ?? 'mock'}`,
    totalQuantity: resolved.reduce((total, { line }) => total + line.quantity, 0),
    cost: { subtotalAmount: { amount: toDecimal(subtotalCents), currencyCode: MOCK_CURRENCY } },
    lines: {
      edges: resolved.map(({ line, product, variant }) => ({
        node: {
          id: line.id,
          quantity: line.quantity,
          merchandise: {
            id: variant.node.id,
            title: variant.node.title,
            price: variant.node.price,
            image: product.featuredImage,
            product: { title: product.title, handle: product.handle },
          },
        },
      })),
    },
  }
}
