# @sentra/flags

**Role:** platform core.

## What it does

A feature-flag seam for Vue applications: one interface, `FlagSource`, with two trivial
implementations — `staticSource` and `httpSource` — behind the injection key
`'sentra:flags'`. As with `@sentra/plugin-analytics`'s `Transport`, choosing a vendor
(LaunchDarkly, a homegrown flag service, a JSON file served from a CDN) is the adopter's
decision; this package supplies the seam and a client that works with no backend at all.

This is **not** `sdk-ops` administration. `sdk-ops` is where flags (and other operational
resources) are created, targeted, and rolled out — the write side, used by an admin
surface. `@sentra/flags` is the read side an application embeds: given a `FlagSource` that
already knows how to fetch resolved values, it evaluates them for the current user. This
package has no concept of creating or editing a flag; it only reads one.

`createFlagClient` splits **async load** from **sync read**: `refresh()` is async and
calls the source; `isOn()` is sync and always returns an answer, immediately, using
whatever snapshot is currently held. Declared defaults — the `default` (and optional
`rollout`) given for each key in `declarations` — are what make the backend optional: a
component renders before any network round trip can finish, and on a source that never
resolves, or one that always rejects, `isOn()` still returns sensible, static behaviour
instead of an error or a suspended render. `ready` (a `Ref<boolean>`) flips to `true` once
one load attempt has completed, successfully or not — a permanently-failing source still
lets a `v-if="ready"` consumer render, with declared defaults, rather than staying
suspended forever. The exception is a source that never _settles_ at all — a request
hung against a dead endpoint, rather than one that fails — which leaves `ready` at
`false` indefinitely. `httpSource` sets no timeout, so if that case matters to you, write
your own `FlagSource` around `fetch` with an `AbortSignal`.

Local overrides (`?ff_<key>=0|1` in the query string, or a JSON object in `localStorage`)
let a single browser flip a flag for itself without waiting on the source. They are read
once, at `createFlagClient` construction — not on every `isOn()` call — so a change to the
query string or `localStorage` takes effect only for a client built after the change.
**Overrides must never be enabled in production** (`allowOverrides` defaults to `false`
and must stay that way there): with them on, any visitor who can edit their own URL or
`localStorage` can flip any flag on themselves, and a crafted link can do it to anyone who
opens it. This is an access-control decision, not a convenience default — enable
`allowOverrides` only in development or a controlled QA environment.

Rollout bucketing uses FNV-1a, chosen for determinism and size. **It is not cryptographic**
and must not be relied on to conceal a user's bucket assignment from that same user — a
rollout percentage is a deployment control, not a secret.

### The typed-key guarantee, precisely

`createFlagClient`'s key union is inferred from the `declarations` object passed to it, so
calling `isOn` with a key not in that object is a compile error — a real, checked
guarantee, because the type comes from the same literal that defines the flags.

`useFlags<K>()` is different: its `K` is supplied by the caller, and the function body is
a cast (`inject(...) as FlagClient<K>`). Nothing checks that the installed client actually
declares the keys `K` names. It gives a call site convenient typing, not a verified one —
a component can name a key the installed client has never heard of and still compile. The
compile-time guarantee belongs to `createFlagClient` alone.

## How to use it

Build a client with declared defaults and a source, then install it:

```ts
import { createFlagClient, flagsPlugin, httpSource } from '@sentra/flags'

const flags = createFlagClient({
  declarations: {
    'checkout.express': { default: false },
    'search.instant': { default: true, rollout: 25 },
  },
  source: httpSource('/api/flags'),
  context: { stableId: currentUser.id },
})

await flags.refresh()
app.use(flagsPlugin, flags)
```

From a component:

```ts
import { useFlags } from '@sentra/flags'

const flags = useFlags<'checkout.express' | 'search.instant'>()
flags.isOn('checkout.express')
```

With no install, `useFlags()` returns `NULL_FLAGS`: `ready` is already `true`, and
`isOn()` returns `false` for every key — a fail-closed default so a guarded consumer
renders immediately instead of waiting on a client that will never arrive.

`staticSource(values)` resolves a fixed `FlagValues` object unchanged — useful for tests
and for any deployment with no flag backend at all. `httpSource(url)` fetches `url` and
parses the JSON body as `FlagValues`, throwing when the response is not `ok` so a 500
error body is never adopted as a genuine snapshot.

## What it depends on

- `vue` — peer dependency (`^3.5.0`). No runtime production dependencies.
