# @sentra/storefront

**Role:** reference implementation — safe to delete. See [the removal procedure](../../docs/proposal/README.md#adopting-it).

## Running it

```bash
cp .env.example .env.local
pnpm --filter @sentra/storefront dev
```

`.env.example` ships with `VITE_SENTRA_MOCKS=true` — mocks are the intended default
posture, but Vite only reads it from `.env.local` (or an equivalent env source), not from
`.env.example` itself. Skip the copy step and `VITE_SENTRA_MOCKS` is unset, `mocksEnabled()`
returns `false`, the Service Worker never starts, and the app makes a real request to
`https://demo-shop.myshopify.com/api/2026-04/graphql.json` with the mock's placeholder
token — which is not a store this repository controls, so the request fails and the
collection page renders its "We couldn't reach the store" error state instead of products.
This was confirmed by running the app both ways: without `.env.local` the console shows a
401 from that real domain; with `.env.local` present the same page renders the 20-product
fixture catalogue with zero network requests leaving the browser.

## The demo controls

Mock builds expose `window.sentraMocks: MockControl` on the page — open the browser
console and set:

```js
window.sentraMocks.scenario = 'throttled'
window.sentraMocks.latencyMs = 800
```

| `scenario`       | What it proves                                                                   |
| ---------------- | -------------------------------------------------------------------------------- |
| `'ok'`           | The default: fixture data, no injected failure.                                  |
| `'throttled'`    | The `throttled` taxonomy branch — Shopify's cost-budget rate limit.              |
| `'network'`      | The `network` branch — the request never gets a usable response.                 |
| `'user_error'`   | The `graphql_user` branch — a cart mutation Shopify rejects on business grounds. |
| `'schema_drift'` | The `schema` branch — a response missing a field the generated types expect.     |

`latencyMs` delays every mocked response, useful for making loading states visible instead
of instantaneous. Setting a scenario mid-session and then triggering the relevant action
(loading the collection, opening a product, adding to cart) is a controlled, repeatable way
to demonstrate every failure state live rather than only in a screenshot.

## Running under the shell

This same app is also loaded, unmodified, as a federated remote by `apps/shell` — the
same `src/federated/index.ts` entry point drives both `main.ts` (standalone) and the
shell's boot sequence. To run it that way:

```bash
VITE_SENTRA_MOCKS=true pnpm --filter @sentra/storefront build
pnpm --filter @sentra/storefront preview --port 4173 --strictPort   # http://localhost:4173
```

`preview` here is a bare `vite preview` in `package.json` — it takes no port or host by
default, so both flags above must be passed explicitly; the shell's own Playwright config
does the same. Then boot the shell (`apps/shell/README.md`), which fetches
`http://127.0.0.1:4173/remoteEntry.js` per `apps/shell/public/remotes.json` and mounts
this app's routes under `/shop`.

Two things change under the shell, and nothing else does:

- **The header.** `apps/shell/src/components/ShellHeader.vue` owns navigation and the
  cart badge when this app runs under the shell; `AppHeader.vue` above still owns the
  equivalent markup when this app runs standalone. Both exist, deliberately — see ADR 0006
  ("Ruling A") for why the header did not move wholesale, and what that costs.
- **The cart badge and drawer.** The shell has no import on this app's Pinia cart store —
  that would make it a build-time dependency and undo the federation boundary (ADR 0006).
  Instead, the cart store emits `cart:updated` on `@sentra/shell-contract`'s `ShellBus`
  whenever its quantity changes, and the shell's header emits `cart:open-requested` when
  its own cart button is clicked; this app's own overlay is what still renders the drawer.

`preview: { cors: true }` in `vite.config.ts` exists only for this: without it, the shell
(a different origin, `:4175`) cannot fetch this app's `remoteEntry.js` at all, and the
browser blocks the script outright. A real deployment should allow-list the host's actual
origin rather than reflecting every origin that asks. Named risk area: access control.

## Architecture

Two routes (`src/router.ts`):

| Path                | Name         | View                 |
| ------------------- | ------------ | -------------------- |
| `/`                 | `collection` | `CollectionView.vue` |
| `/products/:handle` | `product`    | `ProductView.vue`    |

Views are lazily imported so the product page is not in the landing page's bundle.

Cart state lives in a Pinia store (`src/stores/cart.ts`), scoped to this application rather
than to `@sentra/sdk-commerce`: a cart is one application's session state, and putting it in
the SDK would force every future consumer — including an app with no cart at all — to carry
it. The store owns the cart id lifecycle: created on first add, persisted to
`localStorage` for return visits, and forgotten when Shopify reports it no longer exists.

The Storefront client itself is constructed once and reached through a dependency-injection
seam (`src/storefront.ts`): `getStorefrontClient()` builds (or returns the cached) client,
and `setStorefrontClient()` replaces it. Tests and stories call `setStorefrontClient` to
inject a stub, rather than mocking the module — the same choice `@sentra/plugin-analytics`'s
injectable reporters made, because module mocking couples every test to this file's import
graph and cannot be exercised from a story or interaction test.

## Virtualisation

`ProductGrid.vue` virtualises **rows**, not individual cards: a three-column grid showing 24
products has 8 rows, and virtualising cards individually would mean absolute-positioning
every card and re-deriving layout the browser's own grid already computes.

It uses `useVirtualizer` (element-scoped) rather than `useWindowVirtualizer`: under
`happy-dom` (this repository's component-test environment), the window reports zero-size
rects, so a window-scoped virtualiser renders nothing under test and the component's
behaviour becomes unverifiable. An explicit-height scroll container with a measured
`initialRect` keeps the component testable and gives it a fixed, predictable viewport.

## Analytics

`src/analytics.ts` defines `storefrontEventSchema` — the allowlist IS the privacy control.
`createAnalytics` (from `@sentra/plugin-analytics`) strips any property not named in this
schema before a transport ever sees it, so widening the schema is the only way to start
sending a new field: a reviewable, deliberate act, not something a call site can do
unilaterally.

Deliberately **excluded** from every event: product titles and descriptions (merchant
content, unbounded, not ours to forward), search text, and any customer identifier. A
product `handle` or a variant id identifies what happened for analysis without carrying its
copy. Failure telemetry (`storefront_error`) is keyed on the taxonomy's `kind` plus the
operation name — never on `message`, which is Shopify's to change and can echo request
content.

## Security notes

- **The `VITE_` prefix rule.** Vite inlines every `VITE_`-prefixed environment variable into
  the client bundle. That's fine for the public Storefront API token; it would be a real
  leak for an Admin API token, a webhook secret, or any other server-side credential — none
  of those may ever carry a `VITE_` prefix.
- **The single `v-html` exception.** `vue/no-v-html` is an ESLint error across this
  repository. `src/components/RichText.vue` holds its one reviewed suppression: the value
  rendered is always the output of `sanitizeProductHtml` (allowlist, DOMPurify-backed, see
  `packages/sdk-commerce/src/sanitize.ts`), never the raw `UnsafeHtml` the API returns.
- **Checkout stays on Shopify's origin.** `CartDrawer.vue`'s checkout control is a plain
  anchor to `cart.checkoutUrl` — Shopify's hosted, PCI-compliant checkout — not a `fetch`.
  Routing payment through this application would put it in scope for card data it has no
  business touching. The link carries `rel="noopener noreferrer"` since it opens a new
  browsing context.

## Testing

- **Unit and component tests** run under Vitest (`pnpm --filter @sentra/storefront test`):
  the cart store, the router-adjacent views, `CartDrawer`, `ProductGrid`, and the mock DI
  seam.
- **A Playwright E2E suite** runs against the production build
  (`pnpm --filter @sentra/storefront e2e`, `e2e/smoke.spec.ts`), CI-gated on every push. Its
  core happy path — browse the collection, open a product, add it to the cart, open the
  drawer, confirm checkout hands off to Shopify — also asserts that the sanitiser genuinely
  neutralises a hostile description in a real browser: the authoritative proof
  `sanitize.ts`'s own JSDoc claims, since unit tests alone run under jsdom, not a browser.
  Two further specs extend it on paths already exhaustively unit-tested but never proven
  wired together: that the cart survives an in-app route change (not a hard reload — the
  mock cart backend has no persistence layer, which is this mock-first architecture's
  honest limitation, not a bug), and that a failed add-to-cart shows a recoverable toast
  rather than a silently stuck cart.
