# @sentra/sdk-commerce

**Role:** reference implementation — safe to delete. See [the removal procedure](../../docs/proposal/README.md#adopting-it).

## What it is

A typed Shopify Storefront client, mock-first. It talks GraphQL to Shopify's Storefront
API, but nothing that imports this package's main entry needs to know that: every call
returns a `Result<T, StorefrontError>` built from four named failure kinds, never a thrown
string, and the whole thing runs against MSW fixtures with no network and no live store.

## Layering

```
transport  →  operations  →  domain types
(fetch,        (one GraphQL     (ProductSummary, Cart,
 timeout,       document per     CartLine, ... — the
 retry, cost)   call, mapped     shapes applications
                to domain        actually consume)
                types)
```

- **Transport** (`transport.ts`) owns everything network-shaped: timeout, bounded retry,
  cost accounting. It knows nothing about products or carts.
- **Operations** (`operations/*.ts`) each send one generated GraphQL document through the
  transport and map the wire response into a domain type. This is also the one place a
  schema mismatch can be detected — hence `SchemaError` is meaningful, not decorative.
- **Domain types** (`types.ts`) are what `apps/storefront` actually imports:
  `ProductSummary`, `ProductDetail`, `CollectionPage`, `Cart`, `CartLine`, `MoneyV2`. No
  `edges`/`node` GraphQL plumbing leaks past the operations layer.

The package's main entry (`src/index.ts`) has **no Vue import**. Transport, operations,
and the entire error taxonomy are unit-testable without mounting a component — Vue
bindings live behind the separate `@sentra/sdk-commerce/vue` export, and MSW handlers
behind `@sentra/sdk-commerce/mocks`.

## The error taxonomy

Every Storefront call returns `StorefrontResult<T>` — `ok(value)` or `err(error)`, where
`error: StorefrontError` is a discriminated union on `kind`. Consumers branch on `kind`,
never on message text, because message text is Shopify's to change without warning.

| `kind`         | When it occurs                                                                                 | Retryable                                                                                                | What a UI should do                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `network`      | No usable HTTP response arrived (DNS, connection reset, timeout), or the server itself failed. | Yes if no response arrived or the status was ≥500; no on a 4xx — the request was understood and refused. | Show a retry affordance; the transport has already retried up to `maxAttempts`.                                                                                      |
| `throttled`    | The query-cost budget is exhausted.                                                            | Yes, always.                                                                                             | Back off and retry; `throttleStatus` carries the numbers needed to decide how long.                                                                                  |
| `graphql_user` | Shopify validated the request and rejected it on business grounds (`userErrors`).              | No — the input is wrong.                                                                                 | Render `userErrors` against the relevant fields, same as a form validation error.                                                                                    |
| `schema`       | The response did not match the generated types.                                                | No — retrying repeats the same mismatch.                                                                 | Treat as an operational signal, not a user-facing one: the live schema has drifted from the vendored copy this SDK was generated against. Alert, don't just display. |

`isRetryable(error)` is exported so a caller does not have to reimplement this table as a
switch statement.

## Generated types

Nothing in `src/generated/` is hand-written. The pipeline is:

1. `schema/storefront.schema.json` — Shopify's published Storefront API introspection
   schema, vendored (committed) into the repository rather than fetched at build time.
2. `schema/PROVENANCE.json` — records where that file came from: source package, source
   version, the Storefront API version it describes, its SHA-256, and its byte size.
   `src/version.test.ts` recomputes the checksum of the committed schema file on every test
   run and asserts it matches `PROVENANCE.json`, so a schema file edited by hand (rather
   than through `sync-schema`) fails CI instead of silently drifting from its own record.
3. `pnpm --filter @sentra/sdk-commerce sync-schema` re-vendors: downloads the pinned
   `@shopify/hydrogen-react` version, extracts `storefront.schema.json`, and rewrites
   `PROVENANCE.json` with the new checksum. Moving to a newer Storefront API version is
   this one command plus a commit — the diff on `PROVENANCE.json` makes the move visible
   in review.
4. `pnpm --filter @sentra/sdk-commerce build` runs `graphql-codegen` against the vendored
   schema, generating both TypeScript types and typed query strings into `src/generated/`.

The codegen config sets `documentMode: 'string'`. The default codegen output is a
`TypedDocumentNode` — a parsed GraphQL AST — which would have to be printed back to text
before being sent over HTTP, dragging the `graphql` runtime into the browser bundle for
nothing. `documentMode: 'string'` instead generates a `String` subclass carrying phantom
result and variable types: `String(document)` **is** the wire payload, and the generated
types exist only at compile time. Zero runtime GraphQL ships.

## Cost and throttling

The Storefront API rate-limits by **query cost**, not request count — a leaky-bucket
budget refills at a fixed rate, and a request's cost is computed from the shape of the
query. `createStorefrontTransport` accepts an `onCost` hook, called once per response that
reported `extensions.cost`:

```ts
const transport = createStorefrontTransport({
  endpoint,
  token,
  onCost: (cost) => {
    console.debug(
      `query cost: ${cost.requestedQueryCost}, budget: ${cost.throttleStatus?.currentlyAvailable}`,
    )
  },
})
```

When a request is throttled, the retry delay is not a blind backoff. `retryDelayMs`
computes two candidates and takes whichever is longer:

- ordinary exponential backoff (500ms base, doubling, capped at 4000ms), and
- when Shopify reported a `throttleStatus`, the arithmetic answer: the cost deficit
  (`requestedQueryCost - currentlyAvailable`) divided by `restoreRate`, in seconds. Waiting
  less guarantees another throttle; a blind fixed interval is either needlessly slow or
  uselessly fast.

## The sanitisation boundary

`Product.descriptionHtml` is authored in the Shopify admin by whoever has a merchant
account — in a multi-vendor or agency-managed store, not the same trust domain as the
storefront's own developers. Rendering it directly is stored XSS: the payload lives in the
merchant's data, executes in every visitor's session, and inherits the origin's cookies.

The boundary that prevents that:

- **A type boundary, not a convention.** `types.ts` brands raw API strings as
  `UnsafeHtml` and sanitised output as `SafeHtml`. The compiler rejects passing an
  `UnsafeHtml` value anywhere a `SafeHtml` is required, so the only route from the API to
  the DOM runs through `sanitizeProductHtml`.
- **An allowlist, never a denylist**, enforced by DOMPurify — not a regex — against the
  parsed DOM tree, because HTML parsing is adversarial and mutation-XSS lives in the gap
  between what a regex thinks it read and what the browser parser actually builds.
  `SANITIZE_ALLOWED_TAGS` and `SANITIZE_ALLOWED_ATTR` enumerate exactly what a product
  description legitimately needs; `style` is deliberately excluded, since a merchant-
  supplied `style` can position an element over the page as a clickjacking surface.
- **A hardening pass** beyond DOMPurify's own allowlists: links carrying a `target` attribute
  get `rel="noopener noreferrer"` against reverse tabnabbing, and `data:` image sources are
  stripped, since DOMPurify's default `DATA_URI_TAGS` permits `data:` on `img` even though
  it blocks `javascript:` on `href`.
- **A DOM is required, and not every DOM proves it works.** `DOMPurify.isSupported` is not
  evidence of a working sanitiser — measured against dompurify@3.4.14, happy-dom reports
  `isSupported: true` while passing every multi-root payload through untouched.
  `sanitizeProductHtml` runs a self-test probe once per process and throws rather than
  silently returning unsanitised content if the probe fails. The package's own unit tests
  therefore run under `jsdom`, and the authoritative proof is the Playwright assertion
  against a real browser in `apps/storefront/e2e/smoke.spec.ts`.

`apps/storefront/src/components/RichText.vue` is the only `v-html` in the repository —
`vue/no-v-html` is an ESLint error everywhere else, so a second one cannot be added without
a reviewer seeing a deliberate suppression.

## Mocks

`@sentra/sdk-commerce/mocks` is a public subpath, not a test-only helper, because the same
MSW handlers serve three consumers: this package's own contract tests
(`src/mocks/contract.test.ts`), the storefront's dev server, and the storefront's demo
build. One fixture set means the demo cannot drift from what the tests prove.

`createMockControl()` returns a mutable `{ scenario, latencyMs }` object passed to
`createStorefrontHandlers`. Five scenarios:

| `scenario`       | Produces                                                                      |
| ---------------- | ----------------------------------------------------------------------------- |
| `'ok'`           | Normal fixture responses.                                                     |
| `'throttled'`    | A `throttled` `StorefrontError`.                                              |
| `'network'`      | A `network` `StorefrontError` (the request errors before a response arrives). |
| `'user_error'`   | A `graphql_user` `StorefrontError` from a cart mutation's `userErrors`.       |
| `'schema_drift'` | A `schema` `StorefrontError` from a response missing an expected field.       |

`msw` is a devDependency, not a runtime one: the handlers are shipped as source
(`./mocks`) for consumers to wire into their own `setupWorker`/`setupServer` call, so `msw`
itself is each consumer's own dependency rather than something this package's production
bundle carries.

## Live wiring

Swapping from mocks to a live Shopify store is a `.env` change, not a code change — see
`apps/storefront/.env.example`:

```bash
VITE_SENTRA_MOCKS=true
VITE_SENTRA_SHOPIFY_DOMAIN=your-shop.myshopify.com
VITE_SENTRA_SHOPIFY_TOKEN=replace-with-your-public-storefront-api-token
```

**The `VITE_` prefix warning, in full:** Vite inlines every `VITE_`-prefixed environment
variable into the client bundle. That is acceptable for `VITE_SENTRA_SHOPIFY_TOKEN`, which
Shopify scopes as a public Storefront API token and expects to be readable by browsers. It
is **never** acceptable for an Admin API token, a webhook secret, or any other server-side
credential — those must not carry a `VITE_` prefix, because doing so publishes them to
every visitor. The Storefront token is still treated as a credential in this repository: it
is not committed, not logged, and not defaulted to a working value.

## Usage

A framework-free call — no Vue required:

```ts
import { createStorefrontClient } from '@sentra/sdk-commerce'

const client = createStorefrontClient({
  domain: 'demo-shop.myshopify.com',
  token: process.env.STOREFRONT_TOKEN!, // a public Storefront token, from your own store
})

const result = await client.getProduct({ handle: 'stoneware-mug' })
if (result.ok) {
  console.log(result.value?.title)
} else {
  console.error(result.error.kind, result.error.message)
}
```

`useProduct` — reactive, reloads when the handle changes:

```ts
import { useProduct } from '@sentra/sdk-commerce/vue'

const { data: product, error, loading } = useProduct(() => route.params.handle as string)
```

`useCollection` — paginated, with a guarded `loadMore`:

```ts
import { useCollection } from '@sentra/sdk-commerce/vue'

const { products, title, error, loading, hasNextPage, loadMore } = useCollection('tableware')

// call loadMore() from an intersection observer or a scroll-end handler;
// it is a no-op while a load is already in flight or the feed is exhausted.
```

Both `useProduct` and `useCollection` require `app.use(storefrontPlugin, { client })` to
have run before mount — see `apps/storefront/src/main.ts` for the wiring.
