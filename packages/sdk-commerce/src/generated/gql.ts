/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  fragment ProductSummaryFields on Product {\n    id\n    handle\n    title\n    availableForSale\n    featuredImage {\n      url\n      altText\n      width\n      height\n    }\n    priceRange {\n      minVariantPrice {\n        amount\n        currencyCode\n      }\n    }\n  }\n": typeof types.ProductSummaryFieldsFragmentDoc,
    "\n  fragment MoneyFields on MoneyV2 {\n    amount\n    currencyCode\n  }\n": typeof types.MoneyFieldsFragmentDoc,
    "\n  fragment CartFields on Cart {\n    id\n    checkoutUrl\n    totalQuantity\n    cost {\n      subtotalAmount {\n        ...MoneyFields\n      }\n    }\n    lines(first: 50) {\n      edges {\n        node {\n          id\n          quantity\n          merchandise {\n            ... on ProductVariant {\n              id\n              title\n              price {\n                ...MoneyFields\n              }\n              image {\n                url\n                altText\n                width\n                height\n              }\n              product {\n                title\n                handle\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": typeof types.CartFieldsFragmentDoc,
    "\n  query CollectionPage($handle: String!, $first: Int!, $after: String) {\n    collection(handle: $handle) {\n      handle\n      title\n      products(first: $first, after: $after) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            ...ProductSummaryFields\n          }\n        }\n      }\n    }\n  }\n": typeof types.CollectionPageDocument,
    "\n  query ProductDetail($handle: String!) {\n    product(handle: $handle) {\n      ...ProductSummaryFields\n      descriptionHtml\n      variants(first: 20) {\n        edges {\n          node {\n            id\n            title\n            availableForSale\n            price {\n              ...MoneyFields\n            }\n          }\n        }\n      }\n    }\n  }\n": typeof types.ProductDetailDocument,
    "\n  query CartGet($cartId: ID!) {\n    cart(id: $cartId) {\n      ...CartFields\n    }\n  }\n": typeof types.CartGetDocument,
    "\n  mutation CartCreate($lines: [CartLineInput!]) {\n    cartCreate(input: { lines: $lines }) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": typeof types.CartCreateDocument,
    "\n  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {\n    cartLinesAdd(cartId: $cartId, lines: $lines) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": typeof types.CartLinesAddDocument,
    "\n  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {\n    cartLinesUpdate(cartId: $cartId, lines: $lines) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": typeof types.CartLinesUpdateDocument,
    "\n  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {\n    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": typeof types.CartLinesRemoveDocument,
};
const documents: Documents = {
    "\n  fragment ProductSummaryFields on Product {\n    id\n    handle\n    title\n    availableForSale\n    featuredImage {\n      url\n      altText\n      width\n      height\n    }\n    priceRange {\n      minVariantPrice {\n        amount\n        currencyCode\n      }\n    }\n  }\n": types.ProductSummaryFieldsFragmentDoc,
    "\n  fragment MoneyFields on MoneyV2 {\n    amount\n    currencyCode\n  }\n": types.MoneyFieldsFragmentDoc,
    "\n  fragment CartFields on Cart {\n    id\n    checkoutUrl\n    totalQuantity\n    cost {\n      subtotalAmount {\n        ...MoneyFields\n      }\n    }\n    lines(first: 50) {\n      edges {\n        node {\n          id\n          quantity\n          merchandise {\n            ... on ProductVariant {\n              id\n              title\n              price {\n                ...MoneyFields\n              }\n              image {\n                url\n                altText\n                width\n                height\n              }\n              product {\n                title\n                handle\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": types.CartFieldsFragmentDoc,
    "\n  query CollectionPage($handle: String!, $first: Int!, $after: String) {\n    collection(handle: $handle) {\n      handle\n      title\n      products(first: $first, after: $after) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            ...ProductSummaryFields\n          }\n        }\n      }\n    }\n  }\n": types.CollectionPageDocument,
    "\n  query ProductDetail($handle: String!) {\n    product(handle: $handle) {\n      ...ProductSummaryFields\n      descriptionHtml\n      variants(first: 20) {\n        edges {\n          node {\n            id\n            title\n            availableForSale\n            price {\n              ...MoneyFields\n            }\n          }\n        }\n      }\n    }\n  }\n": types.ProductDetailDocument,
    "\n  query CartGet($cartId: ID!) {\n    cart(id: $cartId) {\n      ...CartFields\n    }\n  }\n": types.CartGetDocument,
    "\n  mutation CartCreate($lines: [CartLineInput!]) {\n    cartCreate(input: { lines: $lines }) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": types.CartCreateDocument,
    "\n  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {\n    cartLinesAdd(cartId: $cartId, lines: $lines) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": types.CartLinesAddDocument,
    "\n  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {\n    cartLinesUpdate(cartId: $cartId, lines: $lines) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": types.CartLinesUpdateDocument,
    "\n  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {\n    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": types.CartLinesRemoveDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ProductSummaryFields on Product {\n    id\n    handle\n    title\n    availableForSale\n    featuredImage {\n      url\n      altText\n      width\n      height\n    }\n    priceRange {\n      minVariantPrice {\n        amount\n        currencyCode\n      }\n    }\n  }\n"): typeof import('./graphql').ProductSummaryFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment MoneyFields on MoneyV2 {\n    amount\n    currencyCode\n  }\n"): typeof import('./graphql').MoneyFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment CartFields on Cart {\n    id\n    checkoutUrl\n    totalQuantity\n    cost {\n      subtotalAmount {\n        ...MoneyFields\n      }\n    }\n    lines(first: 50) {\n      edges {\n        node {\n          id\n          quantity\n          merchandise {\n            ... on ProductVariant {\n              id\n              title\n              price {\n                ...MoneyFields\n              }\n              image {\n                url\n                altText\n                width\n                height\n              }\n              product {\n                title\n                handle\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').CartFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CollectionPage($handle: String!, $first: Int!, $after: String) {\n    collection(handle: $handle) {\n      handle\n      title\n      products(first: $first, after: $after) {\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node {\n            ...ProductSummaryFields\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').CollectionPageDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ProductDetail($handle: String!) {\n    product(handle: $handle) {\n      ...ProductSummaryFields\n      descriptionHtml\n      variants(first: 20) {\n        edges {\n          node {\n            id\n            title\n            availableForSale\n            price {\n              ...MoneyFields\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').ProductDetailDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CartGet($cartId: ID!) {\n    cart(id: $cartId) {\n      ...CartFields\n    }\n  }\n"): typeof import('./graphql').CartGetDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CartCreate($lines: [CartLineInput!]) {\n    cartCreate(input: { lines: $lines }) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n"): typeof import('./graphql').CartCreateDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {\n    cartLinesAdd(cartId: $cartId, lines: $lines) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n"): typeof import('./graphql').CartLinesAddDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {\n    cartLinesUpdate(cartId: $cartId, lines: $lines) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n"): typeof import('./graphql').CartLinesUpdateDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {\n    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {\n      cart {\n        ...CartFields\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n"): typeof import('./graphql').CartLinesRemoveDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
