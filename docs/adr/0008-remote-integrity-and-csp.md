# ADR 0008 — Remote integrity and CSP

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decides:** how the shell constrains which origins may serve code and styles at all
  (CSP), and how it verifies that the bytes a trusted origin actually served are the bytes
  an operator vouched for (integrity) — for federated remotes loaded at runtime, which
  neither control was designed for by default.

## Context

ADR 0001 named this gap when M4 shipped: "Runtime-loaded third-party code becomes a
security surface. M5 must address this under transport security (spec §10): CSP
`script-src` must enumerate remote origins, and subresource integrity does not apply
cleanly to federated entries." This ADR is that work. Both controls exist for the same
reason — the shell does not build the code it runs; it fetches an entry script from a URL
named in `apps/shell/dist/remotes.json` at boot time — and both controls have a real,
stated limitation rather than a silent gap.

## Decision: CSP is generated from the manifest, not maintained by hand

`scripts/generate-csp.mjs` reads the built `remotes.json`, derives the distinct remote
origins (`remoteOrigins` in `scripts/csp.mjs`), and builds the policy from them. A
hand-maintained second list of allowed origins — kept separately from the manifest that
already names every origin the shell will execute code from — is the design this
deliberately avoids: two lists that describe the same fact drift, and the drift is
invisible until an audit or an incident finds it. Generating from the manifest means there
is structurally one list.

`security/csp-sources.json` supplies what the manifest cannot: origins the shell has no
way to discover on its own, such as a remote's backend API or CDN. Each entry declares an
`owner` (`platform` or `reference`) and a `reason`, validated by `validateSourceOwners`.
The owner field is what lets `strip-reference.mjs` prune reference-owned origins when the
reference implementation is deleted — without it, an origin added on behalf of
`apps/storefront` would survive that app's deletion and keep widening an adopter's policy
for code that no longer exists. A missing or unrecognised owner fails the build rather
than defaulting, for the same reason ADR 0007 gives no default to a missing `sentra.role`:
defaulting to `platform` lets a reference origin survive the strip silently (over-
permissive); defaulting to `reference` deletes a genuine platform origin with no error
naming why.

`csp-sources.json` may only widen `connect-src`, `img-src`, `font-src`, and `media-src`
(`validateExtraSources`'s `WIDENABLE` set). It can never widen `script-src`: allowing that
would let a JSON file editable outside a security review authorise arbitrary code
execution, which is the one thing this generator must never permit. A wildcard host or a
source that carries a scheme or a path is also rejected outright — CSP reinterprets both
in ways an author rarely intends (`https:` allows every host on the scheme; a path is
honoured as a prefix match only for some directives), so the validator refuses them rather
than accept a value whose actual effect differs from what it appears to say.

## Deployment story for the CSP header file

A `<meta http-equiv="Content-Security-Policy">` tag cannot express everything a real
deployment needs. Chrome's own console diagnostic, produced when the meta form is used,
states it plainly: `frame-ancestors` is ignored entirely when delivered via `<meta>`.
`report-uri` and `report-to` are unavailable in meta form for the same reason — both must
arrive as the `Content-Security-Policy` HTTP response header to have any effect. Because
that Chrome diagnostic is itself a logged console error, and this repository's
platform-only smoke check (`apps/shell/e2e-platform-only/platform-only.smoke.spec.ts`)
fails the build on any unexpected console error, the two delivery forms carry two different
policy strings, built by two functions in `scripts/csp.mjs`: `buildCspPolicyForMeta` omits
`frame-ancestors`, `report-uri`, and `report-to` (its `META_IGNORED_DIRECTIVES` set) from
what `scripts/generate-csp.mjs` injects into `dist/index.html`, while `buildCspPolicy` keeps
the full policy, byte-identical to before this split, for `apps/shell/dist/csp-headers.txt`.
**An adopter who ships only the meta tag has no clickjacking protection from this policy at
all** — this was already true before the split, since the directive was never enforced in
meta form; omitting it from the meta tag changes nothing a browser was doing, it only stops
the meta tag from logging an error about a protection it never provided. `csp-headers.txt`
exists so an operator fronting the shell with a real server (nginx, a CDN, an edge function)
can set the `Content-Security-Policy` header directly and get `frame-ancestors`,
`report-uri`, and `report-to` working. This is a manual step an operator must take; the
build does not and cannot do it for them, because it has no visibility into how the app will
actually be served.

The injector also refuses to guess an insertion point when a document has no recognisable
`<meta charset>` declaration (`injectMeta` in `scripts/generate-csp.mjs`), rather than
falling back to "first child of `<head>`." A charset-less document already has undefined
encoding regardless of where the policy lands, so a fallback insertion point would not fix
anything — it would let a broken template pass a build that reports success. This is a
deliberate refusal, not a missing case to add back.

## `style-src` does not carry `'unsafe-inline'`

The generated policy's `style-src` lists the remote origins — verified necessary by the
Task 1 spike, which found both remotes fail to mount with only `'self' 'unsafe-inline'`
because each remote's federated stylesheet is fetched from its own origin — but omits
`'unsafe-inline'` deliberately. `'unsafe-inline'` on `style-src` would authorise *any*
injected `<style>` element or `style` attribute equally, which defeats the directive's
purpose as a mitigation against style-based injection; it was tested and found
unnecessary rather than assumed unnecessary, on both `/shop` (storefront, unauthenticated)
and, later, the console's real authenticated `/ops` view (Task 6, reaching `OrdersView`
via a `grantOps()` role grant, not the role-guard fallback) — zero CSP violations on
either. It is unneeded because Vite extracts single-file-component `<style>` blocks to
static CSS at build time, and Vue's `:style` bindings are applied through the CSSOM
directly, a mechanism CSP does not govern. If a future component ever needed to inject a
`<style>` tag at runtime, the correct widening is a per-response **nonce** on `style-src`
(a fresh `'nonce-<value>'` token issued per request and attached to the specific tag that
needs it), never `'unsafe-inline'` — a nonce authorises the one tag that carries the
matching value, where `'unsafe-inline'` authorises every inline style unconditionally,
including one an attacker injects. This platform has not needed either so far.

## Remote integrity: Design A rejected, Design B selected

Browser-native Subresource Integrity — an `integrity` attribute on a `<script>` element —
was the first design considered (**Design A**) and was found architecturally unreachable
for this codebase, not merely undesirable. `apps/shell/src/registry/boot.ts` hardcodes
every remote's federation `type` to `'module'`, because the alternative fails ESM loading
outright (`Cannot use import statement outside a module`, reported as the opaque
`RUNTIME-001`). `@module-federation/runtime-core`'s `loadEntryDom()` branches on that
`type` before any plugin hook runs: an ESM remote type routes through `loadEsmEntry()`,
which loads the remote with a bare dynamic `import(url)` and never creates a `<script>`
DOM element at all. The `createScript` plugin hook — real, documented, and exported from
the runtime's public surface — is only reached by the non-ESM `loadEntryScript()` path,
which this platform's remotes never take. The Task 1 spike confirmed this empirically, not
just by reading source: a `createScript` hook that deliberately tried to poison the
`integrity` attribute never fired, and the remote loaded and executed successfully anyway,
because there was no `<script>` element for the attribute to attach to and no native SRI
enforcement to engage. A control reachable only by changing every remote's federation
`type` to a mode this codebase's own code comments call broken is not a control worth
shipping.

**Design B** — hash verification performed independently of the federation runtime,
entirely outside the browser's native SRI mechanism — was selected instead.
`apps/shell/src/registry/integrity.ts`'s `verifyEntries` fetches each manifest entry's
bytes itself, computes `sha384-${base64(digest)}` via `crypto.subtle.digest('SHA-384',
...)`, and compares it against the manifest's stamped `integrity` field before the entry
is ever registered with the federation runtime. Only entries that pass are handed to
`registerRemotes`.

**Design B's limitation, stated plainly rather than hidden:** this is a
time-of-check/time-of-use control. `verifyEntries` fetches and hashes the entry once,
approves it, and then the federation loader fetches the same URL again when it actually
imports the module. A hostile or compromised server could serve different bytes on the
second fetch, after passing verification on the first. Browser-native SRI does not have
this gap — the browser enforces the digest on the exact bytes it executes, because the
attribute lives on the element that triggers the fetch — which is precisely why Design B
is described here as the design used *only because* the loader cannot be given a native
`integrity` attribute, not as an equivalent replacement for it.

## The two-layer contradiction, reconciled

Two comments in shipped source, read independently, appear to disagree.
`packages/shell-contract/src/manifest.ts` (the manifest *type*) says an entry's
`integrity` field is optional because "a platform with no integrity data must still boot."
`apps/shell/src/registry/integrity.ts` (the *runtime verifier*) says "a missing digest
fails closed in a production build and warns in development." Read together, a reader who
only opens `manifest.ts` could conclude an unhashed remote is allowed to load in
production. **It is not, and the runtime governs.** The two statements describe two
different layers that never claimed to say the same thing:

- **The type layer (`manifest.ts`).** `integrity?: string` permits a *parsed, structurally
  valid* manifest entry to exist with no digest at all. A manifest is operator-edited in a
  deployed `dist/`, so a hard type-level requirement would turn one forgotten field into a
  total outage at parse time, before the runtime ever gets a chance to make a
  production/development distinction.
- **The runtime layer (`integrity.ts`).** `verifyEntries`'s `requireIntegrity` parameter
  (`= import.meta.env.PROD` by default) decides what happens to an entry that parsed fine
  but carries no digest: in a production build it is rejected outright ("no integrity
  digest published; refusing to register an unverified remote"); in development it is
  logged with `console.warn` and allowed through. **This is the layer that decides what
  actually loads.** The type permitting an entry to exist is not the same fact as the
  runtime permitting it to run.

Because `manifest.ts`'s original comment read as a standalone claim about runtime
behaviour ("an entry without one is trusted") rather than a claim scoped to its own type
layer, it has been narrowed in this task to say only what the type layer actually
controls, and to point at this ADR for the full two-layer account. No type, behaviour, or
validation logic changed — only that comment's wording.

A platform-only tree is unaffected by any of this: `strip-reference.mjs` prunes the
manifest to `[]`, so there are no entries to verify rather than unverifiable ones.

## The digest form: SHA-384 only, fixed pattern

`INTEGRITY_PATTERN` in `manifest.ts` (`/^sha384-[A-Za-z0-9+/]{64}={0,2}$/`) accepts exactly
one algorithm and exactly one encoding shape, not "any SRI string." SHA-384 was chosen
because it is the practical SRI default and long enough that collision is not a live
concern for a control whose entire job is detecting substitution. A fixed pattern rather
than a general SRI grammar (which also permits `sha256-` and `sha512-`, and multiple
hash-source pairs separated by whitespace) matters because `verifyEntries` computes one
specific digest and compares it for equality against the manifest's string — accepting an
algorithm the verifier does not itself compute would mean a superficially well-formed
digest could never actually match, silently rejecting every remote that used it, or worse,
inviting a future implementation to trust a string it never verified. `scripts/hash-
remotes.mjs`'s `sriHash` emits exactly this form (`sha384-${createHash('sha384')...`), and
the round-trip is checked directly in this ADR's own verification section below.

Malformed-but-present is treated as strictly worse than absent, both in the type
(`integrityProblem` in `manifest.ts`) and by construction in the runtime: a digest that
cannot be checked reads as protection that is not actually there, which is a worse failure
mode than an entry honestly carrying no digest at all.

## The secure-context requirement, and why it is not merely defensive

`crypto.subtle` is `undefined` outside a secure context (HTTPS, or `localhost`/loopback).
Without an explicit guard, calling `crypto.subtle.digest(...)` inside `verifyEntries` on an
insecure origin throws a bare `TypeError` straight out of the function. `apps/shell/src/
main.ts` is exactly `void bootShell()` — no `.catch` anywhere in the boot path — so an
uncaught rejection there does not produce a console warning an operator might notice; it
takes down the entire shell's boot promise silently. **The failure mode is a white screen,
not a logged warning.** This is why `verifyEntries` checks `globalThis.crypto?.subtle ===
undefined` at its own top, before touching any entry, and returns a normal rejection
result naming the actual cause ("SubtleCrypto is unavailable... Serve the shell over
https.") for every entry, rather than letting the exception propagate. The guard is not
defensive polish; it is the difference between a diagnosable rejection and an
undiagnosable blank page.

## The two ways this repository's own E2E suite silently disables its security checks

Both were found by instrumentation after a test passed for the wrong reason, and both are
the more useful lesson than either control on its own — the general failure class this
milestone is about (a check that passes while checking nothing) reproduced itself inside
the tests meant to prove the checks work:

- **`127.0.0.1` is a secure context.** The secure-context branch above exists for a real
  deployment risk, but every E2E run in this repository serves the shell from
  `127.0.0.1`, which the platform's own secure-context definition already includes. The
  branch that fails closed on an insecure origin therefore never executes in this
  repository's own suite. Nothing here is broken — the branch is correct and the CI
  environment is a legitimate secure context — but a reader must not mistake "our suite
  passes" for "the guard has been exercised."
- **MSW's Service Worker is invisible to Playwright's frame-scoped `page.route`.**
  `apps/shell/e2e/integrity.spec.ts`'s tampering tests must intercept and rewrite the
  manifest response to simulate a tampered remote. `page.route('**/remotes.json', ...)`
  never fires in this repository's E2E build, because that build runs with
  `VITE_SENTRA_MOCKS=true`, which registers MSW's Service Worker — and a Service Worker's
  own network handling is invisible to a page-scoped route interceptor. Only
  `page.context().route(...)`, which intercepts at the browser context level rather than
  the frame level, observes it. Written the other way, both new integrity E2E tests would
  have silently exercised the *unverified* code path — passing (or, in the tamper case,
  failing outright with a strict-mode violation on unmodified real data) for a reason
  unrelated to the control under test.

## Consequences

**What this buys:** one generated source of truth for which origins the shell will
execute code from and connect to; a header artifact that lets a real deployment get the
protections a `<meta>` tag structurally cannot provide; and a runtime integrity check that
closes the specific gap native SRI leaves open on this platform (an ESM federation type
that never creates a `<script>` element), stated with its own limitation rather than
oversold as native SRI's equivalent.

**What this costs:** Design B's TOCTOU gap is real and permanent under the current
federation runtime's ESM loading path — it is not fixed by this ADR, only bounded and
disclosed. Every remote must be built and hashed (`hash-remotes.mjs`) before the shell can
verify it, adding a required build step reference implementations must not skip. The
CSP's meta-tag delivery leaves `frame-ancestors` unenforced unless an operator takes the
manual step of serving `csp-headers.txt`'s content as a real header — a step this design
cannot force.

## Alternatives not taken

- **Changing every remote's federation `type` away from `'module'` to reach the
  `createScript` hook (Design A).** Rejected: the codebase's own `boot.ts` documents that
  path as broken (`Cannot use import statement outside a module`), so this would trade a
  disclosed limitation for an undisclosed one.
- **A hand-maintained CSP origin list, independent of the manifest.** Rejected for the
  same two-lists-drift reason ADR 0007 gives for role declarations: the manifest already
  names every origin the shell executes code from, and a second list is a second place for
  that fact to go stale.
- **`'unsafe-inline'` on `style-src` as a blanket allowance.** Rejected — verified
  unnecessary by direct testing on both the unauthenticated storefront route and the
  console's real authenticated view, and it would authorise any injected inline style
  indiscriminately rather than the specific case a nonce would scope.

## Verification

Citation grep, run before and after this task's edits, exactly as specified:

```
rtk proxy grep -rn "ADR 0008" --include="*.ts" --include="*.mjs" . | rtk proxy grep -v node_modules
```

Both times, exactly three matches in the same three files. The comment this task narrowed
(`manifest.ts:19`) grew by one line, so its own citation and the one below it each moved
down by one line; the count and the files did not change:

- Before: `packages/shell-contract/src/manifest.ts:19`,
  `packages/shell-contract/src/manifest.ts:110`,
  `apps/shell/src/registry/integrity.ts:39`
- After: `packages/shell-contract/src/manifest.ts:21`,
  `packages/shell-contract/src/manifest.ts:112`,
  `apps/shell/src/registry/integrity.ts:39`

Each is answered above: `manifest.ts:21` (was `:19`) by "The two-layer contradiction,
reconciled"; `manifest.ts:112` (was `:110`) by "The digest form: SHA-384 only, fixed
pattern"; `integrity.ts:39` by "Remote integrity: Design A rejected, Design B selected"
and its TOCTOU paragraph.

SHA-384 consistency, checked directly rather than assumed:

```
rtk proxy grep -niE "sha384|SHA-384" docs/adr/0008-remote-integrity-and-csp.md packages/shell-contract/src/manifest.ts scripts/hash-remotes.mjs
```

This ADR names SHA-384 and the `sha384-<base64>` form throughout; `manifest.ts`'s
`INTEGRITY_PATTERN` is `/^sha384-[A-Za-z0-9+/]{64}={0,2}$/`; `hash-remotes.mjs`'s
`sriHash` emits `` `sha384-${createHash('sha384').update(buffer).digest('base64')}` ``. All
three agree on the algorithm and the digest form; none of them says SHA-256 or leaves the
algorithm unstated.
