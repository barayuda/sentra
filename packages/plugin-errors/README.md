# @sentra/plugin-errors

**Role:** platform core.

## What it does

A closed-shape, allowlist-only error reporting seam for Vue applications. The seam is
one method — `ErrorSink.report(report: ErrorReport): void` — so a vendor implementation
(Sentry, Bugsnag, a homegrown collector) is roughly ten lines of code behind it: construct
the vendor client, and forward each `ErrorReport` to it inside `report`.

`app.use(errorsPlugin, { sink })` creates a reporter, provides it app-wide behind the
injection key `'sentra:errors'`, and attaches five capture sources:

- **`vue`** — `app.config.errorHandler`, for errors thrown during render, a watcher, or a
  lifecycle hook.
- **`window`** — the `error` event, for uncaught synchronous errors outside Vue's reach.
- **`unhandledrejection`** — the `unhandledrejection` event, for promises rejected with no
  `.catch`.
- **`csp`** — the `securitypolicyviolation` event, documented in detail below.
- **`manual`** — the default `kind` when a call site invokes `reporter.report(error)`
  directly, for errors caught and reported deliberately (a failed fetch in a catch block,
  for instance).

### The CSP finding

The `securitypolicyviolation` listener is the reason this package earns its place. The
shell delivers its Content-Security-Policy as a `<meta http-equiv>` tag rather than a
response header, and `scripts/csp.mjs` strips `report-uri` and `report-to` from that form
because browsers ignore both directives when the policy arrives via `<meta>`. That leaves
no server-side reporting channel at all: a `securitypolicyviolation` document listener is
the _only_ way this application can learn that a violation happened in a real user's
browser. `apps/shell/e2e/csp.spec.ts` already trusts this same event as a test-time oracle
(it collects violations via `document.addEventListener('securitypolicyviolation', ...)`
from before the first script runs); `installErrorSources` generalises that same channel to
runtime, wiring it to the reporter instead of a test-only array.

### Sinks

- `consoleSink()` — writes to `console.error`. Useful in development or as a fallback.
- `beaconSink(url)` — posts `new Blob([JSON.stringify(report)], { type: 'application/json' })`
  via `navigator.sendBeacon(url, body)`, mirroring `beaconTransport` in
  `@sentra/plugin-analytics`. `sendBeacon` survives page unloads that would cancel an
  in-flight `fetch`, which matters here specifically: a page navigating away _because_ of
  the error it is trying to report is exactly the case a fetch-based sink would lose.

**The "ten lines" claim needs one qualification.** A vendor sink that posts to a
third-party collector is ten lines of code _plus a Content-Security-Policy change_: the
collector's origin has to be reachable, and `connect-src` is what gates that. This is not
a gap in the seam — `scripts/csp.mjs:184` already builds `connect-src` from `'self'` plus
the registered federation remote origins, and `scripts/csp.mjs:2` lists `connect-src`
among the directives an entry in `security/csp-sources.json` is permitted to widen. The
policy model anticipates exactly this widening and treats it as a deliberate, reviewable
edit — adding an entry to `security/csp-sources.json` — rather than something that quietly
works or quietly breaks.

Today, `beaconSink` is exported but wired into no application, so the generated policy
needs no change right now and no CSP gate is failing. An adopter who installs
`beaconSink('https://vendor.example/collect')` is the one who takes the CSP-widening step;
this package does not do it on their behalf, and this README should not be read as
implying the policy is already open for it.

### Data-protection guarantees

Two different kinds of guarantee are at work here, and they should not be read as
equivalent:

**Structural (enforced by absent code, not by a filter):**

- `ErrorReport` is a closed shape. There is no field that forwards arbitrary data, and no
  collection path exists for `localStorage`, cookies, form values, session tokens, or user
  identifiers.
- `url` keeps only origin and pathname (`sanitizeUrl`) — the query and hash are discarded
  wholesale, never inspected, because that is where emails and tokens actually live and an
  allowlist of "safe" parameter names is a list nobody maintains.
- `context` is allowlist-only: a key not named in `allowedContextKeys` is dropped, with no
  code path that lets an unlisted key through.

**Best-effort (defence in depth, not load-bearing on its own):**

- `redact()` scrubs identifier-shaped substrings — emails, bearer tokens, long digit runs,
  and free-form query strings — from `message`, `stack`, and any allowlisted **string**
  context value. Pattern matching over prose cannot be proven complete and must not be
  treated as though it were.
- An allowlisted **non-string** context value (a number or boolean) is never passed
  through `redact` at all — for those, the allowlist is the entire guarantee. Putting a
  card number or similar behind a numeric, allowlisted key would ship it unredacted; the
  fix is to not allowlist that key, not to expect `redact` to catch it.

## How to use it

Install the plugin with a sink and an allowlist of context keys:

```ts
import { errorsPlugin, consoleSink } from '@sentra/plugin-errors'

app.use(errorsPlugin, {
  sink: consoleSink(),
  allowedContextKeys: ['componentName'],
})
```

From a component:

```ts
import { useErrors } from '@sentra/plugin-errors'

const errors = useErrors()
errors.report(new Error('failed to load'), { componentName: 'CartSummary' })
```

## What it depends on

- `vue` — peer dependency (`^3.5.0`). No runtime production dependencies.
