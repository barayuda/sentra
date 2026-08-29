import type { StorefrontResult } from '../errors.ts'
import { CollectionPageDocument } from '../generated/graphql.ts'
import type { CollectionPageQuery } from '../generated/graphql.ts'
import type { StorefrontTransport } from '../transport.ts'
import type { CollectionPage } from '../types.ts'
import { mapResult, required } from './assert.ts'
import { mapProductSummary } from './mapping.ts'

/** Input for {@link getCollection}. */
export interface GetCollectionInput {
  /** Collection handle, e.g. `'tableware'`. */
  readonly handle: string
  /** Page size. */
  readonly first: number
  /**
   * Cursor from the previous page's `endCursor`, or null/omitted for page one.
   *
   * Shopify offers cursor pagination only — there is no offset. That is a
   * feature for a moving catalogue: an offset shifts when an item is inserted,
   * so page two would silently repeat or skip products.
   */
  readonly after?: string | null
}

/**
 * Fetches one page of a collection's products.
 *
 * A missing collection is reported as a `schema` error rather than an empty
 * page, because collection handles come from this application's own navigation
 * rather than from user input — their absence means misconfiguration.
 *
 * @param transport - The transport to send through.
 * @param input - Handle, page size, and cursor.
 */
export async function getCollection(
  transport: StorefrontTransport,
  input: GetCollectionInput,
): Promise<StorefrontResult<CollectionPage>> {
  const response = await transport.request<CollectionPageQuery>(String(CollectionPageDocument), {
    handle: input.handle,
    first: input.first,
    after: input.after ?? null,
  })

  return mapResult(response, (data): CollectionPage => {
    const collection = required(data.collection, '$.collection')
    const products = required(collection.products, '$.collection.products')
    return {
      handle: required(collection.handle, '$.collection.handle'),
      title: required(collection.title, '$.collection.title'),
      products: required(products.edges, '$.collection.products.edges').map((edge, index) =>
        mapProductSummary(edge?.node, `$.collection.products.edges[${index}].node`),
      ),
      hasNextPage: required(
        products.pageInfo?.hasNextPage,
        '$.collection.products.pageInfo.hasNextPage',
      ),
      endCursor: products.pageInfo?.endCursor ?? null,
    }
  })
}
