/**
 * Every GraphQL document this SDK sends, in one file.
 *
 * They live together, separate from the functions that execute them, because
 * they are the contract with Shopify: reviewing a query change means reading
 * this file, and codegen validates every field here against the vendored
 * schema at build time. A misspelled field fails `pnpm build`, not production.
 *
 * Fragments keep the product shape identical between listing and detail, so
 * the mapping code in `operations/` cannot drift between the two.
 */

/** Fields shared by every product surface. */
export const PRODUCT_SUMMARY_FRAGMENT = /* GraphQL */ `
  fragment ProductSummaryFields on Product {
    id
    handle
    title
    availableForSale
    featuredImage {
      url
      altText
      width
      height
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
  }
`

/** Money fields, shared by cart totals and line prices. */
export const MONEY_FRAGMENT = /* GraphQL */ `
  fragment MoneyFields on MoneyV2 {
    amount
    currencyCode
  }
`

/** Cart shape returned by every cart query and mutation. */
export const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        ...MoneyFields
      }
    }
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              price {
                ...MoneyFields
              }
              image {
                url
                altText
                width
                height
              }
              product {
                title
                handle
              }
            }
          }
        }
      }
    }
  }
`

/** Paginated collection listing. Cursor pagination is Shopify's only option. */
export const COLLECTION_PAGE_QUERY = /* GraphQL */ `
  query CollectionPage($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      handle
      title
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            ...ProductSummaryFields
          }
        }
      }
    }
  }
`

/** Product detail, including the merchant-authored HTML description. */
export const PRODUCT_DETAIL_QUERY = /* GraphQL */ `
  query ProductDetail($handle: String!) {
    product(handle: $handle) {
      ...ProductSummaryFields
      descriptionHtml
      variants(first: 20) {
        edges {
          node {
            id
            title
            availableForSale
            price {
              ...MoneyFields
            }
          }
        }
      }
    }
  }
`

export const CART_GET_QUERY = /* GraphQL */ `
  query CartGet($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
`

export const CART_CREATE_MUTATION = /* GraphQL */ `
  mutation CartCreate($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const CART_LINES_ADD_MUTATION = /* GraphQL */ `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const CART_LINES_UPDATE_MUTATION = /* GraphQL */ `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const CART_LINES_REMOVE_MUTATION = /* GraphQL */ `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`
