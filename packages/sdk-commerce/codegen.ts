import type { CodegenConfig } from '@graphql-codegen/cli'

/**
 * Generates types and typed query strings from the vendored schema.
 *
 * `documentMode: 'string'` is the load-bearing option. The default output is a
 * `TypedDocumentNode` — a parsed GraphQL AST — which would have to be printed
 * back to text before being POSTed, and would drag the `graphql` runtime into
 * the browser bundle for nothing. `TypedDocumentString` is a `String` subclass
 * carrying phantom result and variable types: `String(document)` is the wire
 * payload, and the types exist only at compile time. Zero runtime GraphQL ships.
 *
 * The preset also prunes to reachable types, so a 771 KB schema yields a few
 * dozen KB of reviewable output rather than all 424 types.
 */
const config: CodegenConfig = {
  schema: './schema/storefront.schema.json',
  documents: ['src/operations/documents.ts'],
  ignoreNoDocuments: false,
  generates: {
    './src/generated/': {
      preset: 'client',
      presetConfig: {
        /* Fragment masking hides fragment fields behind opaque types. Useful in
           large apps with colocated fragments; here it would only force
           `useFragment` calls through our own mapping layer, which already is
           the single place the wire shape is read. */
        fragmentMasking: false,
      },
      config: {
        documentMode: 'string',
        useTypeImports: true,
      },
    },
  },
}

export default config
