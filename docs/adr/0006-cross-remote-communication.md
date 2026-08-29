# ADR 0006 — Cross-remote communication

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decides:** how the shell and a remote exchange information without one importing the
  other.

## Context

The shell's header shows a cart badge and a button that opens the cart drawer. The cart
itself — its line items, its running total — lives in the storefront remote's own Pinia
store. The shell cannot import that store: doing so would make the storefront a
build-time dependency of the host, which is precisely the coupling ADR 0001 and ADR 0004
exist to remove. A federated import for state is a monolith with extra deploy steps, not
a federated one.

## Decision

A typed event bus, `ShellBus`, published from `@sentra/shell-contract` — a shared
**workspace** package installed as an ordinary dependency, not a federated import — so
each remote's own package typechecks and its own test suite runs with no host present at
all. `ShellEventMap` (`packages/shell-contract/src/bus.ts`) is a closed map of exactly
four events:

| Event | Payload | Direction |
| --- | --- | --- |
| `cart:updated` | `{ totalQuantity: number }` | remote → shell |
| `cart:open-requested` | `{ origin: string }` | shell → remote |
| `session:changed` | `{ session: Session \| null }` | shell → remotes |
| `remote:failed` | `{ name: string; reason: string }` | shell → (published; no application subscriber today) |

The bus instance travels to a remote through `RemoteContext.register(app, ctx)` — the one
call every `RemoteModule` implements, and the same call each remote's own standalone
`main.ts` also makes to boot itself. It is **not** a module-level singleton a remote could
import directly; `apps/shell/src/registry/boot.ts` constructs one `ShellBus` per boot and
hands it to every remote through `ctx.bus` at registration time, which is what lets a
standalone remote run with its own bus (or `NULL_BUS`, the `inject()` default) with no
shell present.

`remote:failed` is emitted by the shell itself, after `app.mount()`, when a remote failed
to load or register during boot (`boot.ts`) — it is verified in
`packages/shell-contract/src/bus.test.ts`, and every current failure is also logged
directly to `console.error` at the emission site. No shipped component currently
subscribes to it; it exists as part of the closed contract for a future banner or toast
to consume, not as a currently-wired notification path. Stated here rather than implied,
because an ADR that describes a subscriber that does not exist would be a confident wrong
answer to the exact question a review would ask.

## Bidirectionality

`cart:updated` flows remote → shell: the storefront's cart store, on every mutation,
emits its new `totalQuantity`; `apps/shell/src/components/ShellHeader.vue` subscribes and
projects that number onto its own badge, explicitly documented in the component itself as
"a subscriber, not an owner" of the cart.

`cart:open-requested` flows shell → remote: `ShellHeader.vue`'s cart button emits it with
`{ origin: 'shell-header' }`; the storefront's own cart overlay is what actually owns and
renders the drawer, and listens for the request to open it.

A one-way bus would have forced the drawer itself into the shell — the shell would need
to render *something* in response to the button click, and the only thing worth
rendering is the cart's contents, which live in the remote. Two directions on one typed
bus keep ownership of the drawer's markup and state inside the remote that owns the data,
while still letting the shell's chrome trigger it.

## Ruling A, stated honestly

The milestone's plan called for moving `AppHeader.vue` into the shell. It did not move:
it stayed in the storefront, unchanged, because M3's three end-to-end tests drive that
exact header and the same plan promised those tests would stay unchanged too. Both files
exist today — `apps/shell/src/components/ShellHeader.vue` and
`apps/storefront/src/components/AppHeader.vue` — and neither is a thin wrapper around the
other.

What moved is the *responsibility*, not the code. Under the shell, `ShellHeader` owns
navigation chrome and the cart badge, fed by `cart:updated`; standalone, `AppHeader`
still owns the equivalent markup directly, fed by a prop. The cost is real: cart-badge
markup and behaviour now exist in two components, and a change to one — say, a new
badge state for an empty cart — can be made in one and missed in the other. The
mitigation is that both are exercised by tests that would fail on a silent drift:
`AppHeader.vue`'s behaviour by the storefront's own M3 test suite, `ShellHeader.vue`'s
by the shell's federated E2E suite (`apps/shell/e2e/shell.spec.ts`, which asserts the
badge reflects the storefront's cart across the federation boundary). The alternative —
rewriting M3's already-passing E2E suite to chase a header refactor — would have bought
tidier code at the price of the regression net that makes the refactor safe to ship at
all. That trade was not taken.

## What was rejected

- **A shared Pinia store across remotes.** Couples remotes to each other's exact state
  shape and update timing, and defeats independent deployment — a store's shape becomes
  a cross-team API that changes without a version.
- **`window` custom events.** Untyped by construction — every payload is `unknown` at the
  listener — and global in scope: any script on the page can emit or observe them, with
  no way to restrict who is allowed to.
- **A federated import of the storefront's cart store into the shell.** The exact
  coupling ADR 0001 exists to remove: a build-time dependency on a remote's internals,
  which is a monolith with extra deploy steps rather than a federated platform.

## Verification

- `ShellEventMap`'s four events, `ShellBus`'s interface, `NULL_BUS`, and the
  `'sentra:shell-bus'` string key confirmed by reading `packages/shell-contract/src/bus.ts`
  in full.
- `cart:updated`'s emission and `cart:open-requested`'s handling confirmed in
  `apps/shell/src/components/ShellHeader.vue`.
- `remote:failed`'s emission site and its lack of a production subscriber confirmed by
  reading `apps/shell/src/registry/boot.ts` in full and grepping `remote:failed` across
  `apps/shell/src` and `packages/shell-contract/src` — the only matches outside `boot.ts`
  and the type declaration are `packages/shell-contract/src/bus.test.ts`.
- The existence of both `ShellHeader.vue` and `AppHeader.vue`, and that neither re-exports
  or wraps the other, confirmed by reading both files.
