# Feasibility review: cross-device wishlist

**Classification: PUBLIC**

Reviewing [sample-prd.md](./sample-prd.md) against the repository as it
actually is, not against what a wishlist generally requires. Every claim below
was checked with:

```bash
rtk grep -rn "wishlist\|favorite\|favourite" packages/sdk-commerce/src apps/storefront/src
rtk grep -rn "localStorage" apps/storefront/src packages/sdk-commerce/src
rtk ls packages/sdk-commerce/src
```

The first command returned zero matches. There is no wishlist, favorite, or
favourite code anywhere in the SDK or the storefront — this feature does not
exist in any form today, not even a stub.

## What the platform already provides

Nothing wishlist-specific, but several adjacent patterns a wishlist would
reuse:

- **A precedent for persisting an id across visits, on one device.**
  `apps/storefront/src/stores/cart.ts` persists the cart's id under a fixed
  `localStorage` key (`CART_ID_STORAGE_KEY`, line 14) through
  `readStoredCartId`/`writeStoredCartId` (lines 24–40), wrapped in `try`/`catch`
  because `localStorage` throws rather than returning `null` in Safari private
  mode. A wishlist's local-only id (or item list) would follow this exact
  shape.
- **A pattern for adding a typed operation module against the vendored
  schema.** `packages/sdk-commerce/src/operations/collections.ts` (61 lines)
  and `packages/sdk-commerce/src/operations/products.ts` (47 lines) show the
  small-module shape for a read-oriented commerce operation;
  `packages/sdk-commerce/src/operations/cart.ts` (327 lines) shows the larger
  shape once mutations (create, add, update, remove) are involved. A wishlist
  operation module sits between these two in scope.
- **A mock-first pattern for a stateful resource.**
  `packages/sdk-commerce/src/mocks/store.ts` implements an in-memory cart
  (`createMockCart`, `findMockCart`, `addMockLines`) purely so the SDK's own
  contract tests and the storefront's dev/demo builds never touch a real
  endpoint. A wishlist resource would need the same kind of mock store to be
  tested under this platform's existing discipline (ADR 0003, below).
- **A session/identity shape already exists — but is explicitly not
  authentication.** `packages/shell-contract/src/session.ts` defines a
  `Session` type (opaque `id`, `displayName`, `role`) and
  `createSessionPlugin`/`useSession` to provide and read it across the
  federation boundary. `apps/shell/src/session.ts` is where it is populated:
  `initialSession()` (lines 20–24) returns a hardcoded
  `{ id: 'demo-user', displayName: 'Demo User', role }`, with only `role`
  read from `localStorage` (`ROLE_STORAGE_KEY`, `sentra:role`). The file's own
  comment on `ROLE_STORAGE_KEY` (line 8) and the doc comment above
  `initialSession` are explicit: "**This is not authentication.** The role
  lives in `localStorage` and the client decides what it is." There is no
  per-user account and no server-issued identity — only a fixed demo id.
- **A closed, reviewed cross-remote event map.**
  `packages/shell-contract/src/bus.ts`'s `ShellEventMap` already carries
  `session:changed` and the cart's own `cart:updated` event, deliberately kept
  closed (the file's own comment: "An open bus ... moves every mistake to
  runtime"). A wishlist badge in the shell header would reuse this mechanism
  rather than needing a new one invented, following ADR 0006.

## What it does not

Two things the PRD's core acceptance criterion needs, neither of which this
platform includes:

- **A real, durable user identity.** The only identity concept in the repo
  (`packages/shell-contract/src/session.ts`'s `Session`, populated by
  `apps/shell/src/session.ts`) is a hardcoded demo id with no sign-in flow and
  no server issuing or verifying it. "Signs in on a second device" in the PRD
  has nothing to attach to today.
- **A server-side store for user data.** Every `localStorage` use found in
  Step 1 (`apps/storefront/src/stores/cart.ts` and its tests) is scoped to one
  browser on one device by construction — that is what `localStorage` is.
  Nothing in the repository talks to a durable backend for per-user data; per
  ADR 0003 the storefront's commerce operations are deliberately mock-first
  and run against a vendored schema, not a live store.

This is exactly the boundary
[`docs/proposal/README.md`](../proposal/README.md)'s "4. Batteries included,
and not" section is scoped to hold (its prose is written in a later task, but
the heading names the gap this feature falls into): a durable, cross-device
identity and a server-side data store are both things an adopting team must
still build, not things this platform ships.

## Which recorded decisions constrain the answer

- **ADR 0003 — Vendored schema, generated types, mock-first commerce**
  (`docs/adr/0003-vendored-schema-and-mock-first-commerce.md`). Shopify's
  Storefront API — the schema this SDK's types and operations are generated
  from — has no first-party wishlist concept. A wishlist operation cannot be
  added to `packages/sdk-commerce` by generating it from the vendored schema
  the way `packages/sdk-commerce/src/operations/collections.ts` or
  `packages/sdk-commerce/src/operations/cart.ts` were; it would need either a
  hand-written operation against a different (non-Shopify) backend, or to
  live outside `@sentra/sdk-commerce` entirely. Whichever backend it targets,
  ADR 0003's mock-first discipline still applies: it needs a
  `packages/sdk-commerce/src/mocks/store.ts`-style in-memory store for tests
  and demo builds before it needs a real endpoint.
- **ADR 0005 — Federation shared singletons**
  (`docs/adr/0005-federation-shared-singletons.md`). `apps/storefront/src/stores/cart.ts`'s
  own doc comment explains why the cart store lives in the storefront app and
  not in `@sentra/sdk-commerce`: "a cart is one application's session state,"
  and putting it in the SDK would force every consumer to carry it. A wishlist
  store faces the identical question — if only the storefront ever reads it,
  it belongs there by the same reasoning; if the shell header needs to badge
  it (as it does for the cart), ADR 0005's singleton rules govern how that
  state can be shared instead of each remote loading its own copy.
- **ADR 0006 — Cross-remote communication**
  (`docs/adr/0006-cross-remote-communication.md`). The cart badge in the shell
  header is not read directly from the storefront's Pinia store — ADR 0006
  requires that state cross the federation boundary as an event on
  `packages/shell-contract/src/bus.ts`'s closed `ShellEventMap`, not as an
  import. A wishlist badge would need the same treatment: a new,
  deliberately-added event, not a shortcut import of the storefront's store.

## Options, with trade-offs

1. **Local-only, no identity.** Store the wishlist itself in `localStorage`
   under a fixed key, exactly like `CART_ID_STORAGE_KEY` in
   `apps/storefront/src/stores/cart.ts` — except storing the item list, not
   just an id, since there is no server to fetch it back from. Cheapest, and
   needs no new architectural decision. **Fails the PRD's core acceptance
   criterion outright**: it does not survive a change of browser or device,
   which is the entire ask.
2. **Shell-session-scoped.** Key the wishlist by the existing (demo)
   `Session.id` from `packages/shell-contract/src/session.ts`, store it
   client-side, and publish changes on the bus per ADR 0006 so any remote can
   show a badge. This makes the wishlist consistent across remotes within one
   browser and demonstrates the intended cross-remote wiring, but `Session.id`
   is still the hardcoded `'demo-user'` from `apps/shell/src/session.ts` —
   it still does not survive a change of device, because nothing server-side
   backs it. It only looks like it solves the PRD until someone opens a second
   browser.
3. **Full server-backed.** A real sign-in flow issuing a stable per-user id,
   plus a server-side store keyed by that id, with `packages/sdk-commerce`
   (or a new SDK, since ADR 0003 ties this package to Shopify's schema)
   calling it. This is the only option that actually satisfies the PRD. It
   requires building an identity system and a backend this platform does not
   provide any part of — the client-side patterns above (operation module
   shape, mock-first tests, bus event) still apply once that backend exists,
   but building the backend and the identity system is work with no head
   start here.

## Recommendation, and what would change it

Recommend **option 2** as the near-term build: it is honest about not meeting
the PRD's stated acceptance criterion, but it exercises the real
cross-remote-state pattern (ADR 0005, ADR 0006) so that swapping in a real
identity later is a backend change, not a rearchitecture. Ship it labeled as
"saved on this device" rather than "wishlist," so the gap between what it does
and what the PRD asked for is visible to the shopper, not just to engineering.

This recommendation changes if either of two things becomes true:

- A real sign-in system already exists or is already committed to elsewhere
  in the product (outside this repository) — in which case option 3 is the
  right recommendation and the estimate should be revisited entirely, since
  none of the identity work would need to be built here.
- The product owner accepts "same browser, cleared only by the user" as
  satisfying "survives across devices" for a first release — in which case
  option 1 is sufficient and cheaper than option 2, since the cross-remote
  bus wiring in option 2 buys nothing the PRD asked for on its own.
