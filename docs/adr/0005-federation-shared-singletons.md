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
(`@sentra/ui`, `@sentra/tokens`, `@sentra/shell-contract`, `@sentra/i18n`,
`@sentra/plugin-errors`, `@sentra/flags`) are `singleton: false`.
`apps/shell/vite.config.ts` states this split explicitly:

```ts
shared: {
  vue: { singleton: true, requiredVersion: '3.5.42' },
  'vue-router': { singleton: true },
  pinia: { singleton: true },
  '@sentra/ui': { singleton: false },
  '@sentra/tokens': { singleton: false },
  '@sentra/shell-contract': { singleton: false },
  '@sentra/i18n': { singleton: false },
  '@sentra/plugin-errors': { singleton: false },
  '@sentra/flags': { singleton: false },
},
```

## Why the asymmetry is safe

Every `sentra:`-namespaced injection key in the workspace is a **string**, not a
`Symbol()` — this table includes every one found, whether it is published from a
`packages/*` plugin or defined locally by an app:

| Key | Defined at |
| --- | --- |
| `'sentra:toast'` | `packages/ui/src/components/Toast/plugin.ts` |
| `'sentra:analytics'` | `packages/plugin-analytics/src/plugin.ts` |
| `'sentra:storefront'` | `packages/sdk-commerce/src/vue/plugin.ts` |
| `'sentra:shell-bus'` | `packages/shell-contract/src/bus.ts` |
| `'sentra:session'` | `packages/shell-contract/src/session.ts` |
| `'sentra:ops'` | `apps/console/src/ops.ts` |
| `'sentra:remote-overlays'` | `apps/shell/src/remote-overlays.ts` |
| `'sentra:i18n'` | `packages/i18n/src/vue.ts` |
| `'sentra:errors'` | `packages/plugin-errors/src/vue.ts` |
| `'sentra:flags'` | `packages/flags/src/vue.ts` |

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

## Convention — install order on a shared `app` instance

`singleton: false` for `@sentra/*` keeps each container's copy of a plugin independent at
the module level, but it does not give a remote its own Vue `app`. A remote never gets one:
`apps/shell/src/registry/boot.ts` calls `outcome.module.register(app, { bus,
basePath: outcome.entry.basePath })` for every remote — handing it the shell's own `app`
instance, not a fresh one. `app.provide(key, value)` for a key that instance already
provides *replaces* the previous value for the whole container; it does not scope the new
value to the calling remote's subtree. A remote that calls
`app.provide(I18N_INJECTION_KEY, …)` during `register()` therefore does not install its own
i18n instance beside the shell's — it silently wipes the shell's instance for every other
component in the container, not just its own.

**The rule:** a federated remote must never call `app.provide` for a key the shell already
provides. It consumes the shell's instance via `inject`; the shell owns installation. A
remote that needs its own messages **merges into** the shared instance rather than
replacing it.

**Why the failure is silent:** the clobbering remote works perfectly — it provided what it
needed, and its own components resolve exactly the instance it just installed. Every
*other* part of the container breaks instead, which is why the symptom surfaces far from
the cause. This is the same silence this ADR's Context section already documents at
`inject` matching on key identity rather than on provider intent (see above, on
`vue-router`'s and Pinia's `Symbol` keys resolving to `undefined` with no error naming the
cause) — a wrong-key `inject` and a replaced `provide` are two different mechanisms
producing the identical shape of failure: the container keeps running, and the break shows
up somewhere that never touched the line that caused it.

`apps/storefront/src/federated/register.ts` was corrected to merge rather than replace;
its reviewer confirmed the fix was load-bearing by reverting it directly and watching two
named federated tests fail at their exact assertion lines.

**The residual hazard, stated plainly:** install order across the three apps is currently
inconsistent, and nothing enforces this rule mechanically — **it is unenforced.** No lint
rule, runtime guard, or CI check exists for it. The federated e2e suite catches a violation
only incidentally, because a remote happens to be registered in the suite that exercises
the affected path; a configuration where no such remote is registered would not catch it at
all. This convention is documentation of the correct pattern and an honest statement of
what is not mechanically checked, not a claim that a gate exists.

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
