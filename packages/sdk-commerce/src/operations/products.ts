import type { StorefrontResult } from '../errors.ts'
import { ProductDetailDocument } from '../generated/graphql.ts'
import type { ProductDetailQuery } from '../generated/graphql.ts'
import type { StorefrontTransport } from '../transport.ts'
import { asUnsafeHtml, type ProductDetail } from '../types.ts'
import { mapResult, required } from './assert.ts'
import { mapProductSummary, mapVariant, requiredString } from './mapping.ts'

/** Input for {@link getProduct}. */
export interface GetProductInput {
  /** URL handle, e.g. `'stoneware-mug'`. */
  readonly handle: string
}

/**
 * Fetches one product by handle.
 *
 * Resolves to `null` — not an error — when the handle does not exist. A handle
 * comes from the URL bar, so "no such product" is an ordinary answer the router
 * should turn into a not-found view; treating it as a failure would make every
 * mistyped link look like an outage.
 *
 * @param transport - The transport to send through.
 * @param input - The handle to fetch.
 */
export async function getProduct(
  transport: StorefrontTransport,
  input: GetProductInput,
): Promise<StorefrontResult<ProductDetail | null>> {
  const response = await transport.request<ProductDetailQuery>(String(ProductDetailDocument), {
    handle: input.handle,
  })

  return mapResult(response, (data): ProductDetail | null => {
    if (!data.product) return null
    const node = data.product
    return {
      ...mapProductSummary(node, '$.product'),
      descriptionHtml: asUnsafeHtml(
        requiredString(node.descriptionHtml, '$.product.descriptionHtml'),
      ),
      variants: required(node.variants?.edges, '$.product.variants.edges').map((edge, index) =>
        mapVariant(edge?.node, `$.product.variants.edges[${index}].node`),
      ),
    }
  })
}
