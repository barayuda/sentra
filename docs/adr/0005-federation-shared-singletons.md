# ADR 0005 — Federation shared singletons

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decides:** which dependencies are shared as singletons across the federation
  boundary, and why the workspace's own `@sentra/*` packages are handled differently.

## Context

Vue's `provide`/`inject` matches on key identity, not on the string a developer happens
to type. `vue-router`'s `routerKey` and Pinia's `piniaSymbol` are module-level `Symbol`
values, and Pinia additionally holds a module-level `activePinia` reference. Module
Federation loads each container's own copy of its dependencies unless told otherwise; two
independently-bundled copies of `vue-router` produce two distinct `Symbol` values for
`routerKey`; and an `inject(routerKey)` running against the wrong copy misses silently.
`useRoute()` then returns `undefined` inside a remote, with no error naming the cause —
the failure is silent because `inject` was designed to make "no provider" and "wrong key
identity" indistinguishable.

## Decision

`vue`, `vue-router`, and `pinia` are `singleton: true` in every container's federation
config — the host and both remotes agree on this. `@sentra/*` packages
(`@sentra/ui`, `@sentra/tokens`, `@sentra/shell-contract`) are `singleton: false`.
`apps/shell/vite.config.ts` states this split explicitly:

```ts
shared: {
  vue: { singleton: true, requiredVersion: '3.5.42' },
  'vue-router': { singleton: true },
  pinia: { singleton: true },
  '@sentra/ui': { singleton: false },
  '@sentra/tokens': { singleton: false },
  '@sentra/shell-contract': { singleton: false },
},
```

## Why the asymmetry is safe

Every `@sentra/*` injection key in the workspace is a namespaced **string**, not a
`Symbol()`:

| Key | Defined at |
| --- | --- |
| `'sentra:toast'` | `packages/ui/src/components/Toast/plugin.ts` |
| `'sentra:analytics'` | `packages/plugin-analytics/src/plugin.ts` |
| `'sentra:storefront'` | `packages/sdk-commerce/src/vue/plugin.ts` |
| `'sentra:shell-bus'` | `packages/shell-contract/src/bus.ts` |
| `'sentra:session'` | `packages/shell-contract/src/session.ts` |
| `'sentra:ops'` | `apps/console/src/ops.ts` |

Each is declared the same way — a plain string, cast to a typed `InjectionKey` for the
type-checker's benefit only, e.g. `packages/plugin-analytics/src/plugin.ts`:

```ts
/** String-keyed so tests can provide a client without importing this instance. */
export const ANALYTICS_INJECTION_KEY =
  'sentra:analytics' as unknown as InjectionKey<AnalyticsClient>
```

`inject`/`provide` resolve a string key by value equality, not by reference. Two bundled
copies of `@sentra/plugin-analytics` — one inside the shell's own build, one inside a
remote's — each produce the same string `'sentra:analytics'`, so `inject` resolves
correctly regardless of which copy's `provide()` call actually ran. This holds for every
`@sentra/*` package that provides something across the boundary; none of them relies on
Symbol identity. The cost is duplicated bytes: a remote's bundle carries its own copy of
`@sentra/plugin-analytics` even though the shell also bundles one. The benefit is that a
remote can ship a different `@sentra/ui` version without a shared-module version
negotiation failure taking down the platform — `singleton: false` means Federation never
has to arbitrate which copy wins.

This is not a workaround; it is the deliberate reason the injection keys were written as
strings in the first place. Duplicated bytes, identical behaviour.

## Ruling G — no `requiredVersion` on `@sentra/*` shared entries

Every workspace package in this monorepo is `version: 0.0.0`. `requiredVersion` is a
semver range Federation checks the shared module against at runtime; any range stricter
than `0.0.0` itself (e.g. `^0.0.0` under normal semver rules, which excludes even
`0.0.1`) would be unsatisfiable by every real copy in the workspace, and Federation would
reject the share outright. So `@sentra/*` entries in every container's `shared` map carry
no `requiredVersion` at all.

`vue` is the exception, and deliberately so: it carries a real, meaningful version
(`requiredVersion: '3.5.42'`), because a `vue` mismatch across the boundary is the
concrete failure mode this whole ADR exists to prevent — a version skew there is a
genuine incompatibility worth failing loudly on, unlike a workspace package whose version
number carries no information at all.

## Consequences

**What this buys:** `vue-router` and Pinia behave as one true instance across host and
remotes — one router, one route, one active Pinia — while `@sentra/*` packages stay free
to version independently per remote, with no build coordination required between teams
that ship different remotes.

**What this costs:** `@sentra/*` code ships once per container that uses it. For small
packages (`@sentra/shell-contract`, `@sentra/ui`) this is a real but modest amount of
duplicated bytes across three containers, traded for the decoupling above.

## Alternatives not taken

- **`singleton: true` for every shared dependency, including `@sentra/*`:** would remove
  the byte duplication, but reintroduces exactly the version-negotiation coupling this
  ADR exists to avoid for workspace packages whose version field carries no real
  information (`0.0.0` everywhere).
- **`Symbol()` injection keys for `@sentra/*` plugins:** the idiomatic Vue pattern, and
  what would be reached for outside a federation context — but a `Symbol()` is only
  identical to itself within one loaded copy of the module that created it, which is
  precisely the failure mode this ADR's Context section describes for `vue-router` and
  Pinia. String keys were chosen for every `@sentra/*` plugin specifically to sidestep it.
