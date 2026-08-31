# ADR 0012 — What the platform batteries collect, and how that is enforced

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-31
- **Decides:** what `@sentra/plugin-errors`'s error reports and `@sentra/flags`'s
  targeting context are permitted to carry off the client, and how that permission is
  enforced.

## Context

`@sentra/plugin-errors` and `@sentra/flags` both send application data to a third party
on the adopter's behalf — an error-tracking vendor behind an `ErrorSink`, a flag-evaluation
service behind a `FlagSource` — on every error and on every flag evaluation, respectively.
Neither package controls what that third party does with the payload once it arrives.
The only guarantee either package can make is about what it forwards in the first place:
a payload that never contains an identifier cannot leak one downstream, regardless of the
vendor's own practices. That is the guarantee this ADR records, and it names where it is
structural — enforced by the absence of a code path — versus where it is pattern-based
best effort that cannot be proven complete.

## Decision

Both seams collect nothing identifying by default, and the two mechanisms that make that
true are, in order of strength:

**1. Structural — enforced by absent code, not by a filter.**

- `ErrorReport` (`@sentra/plugin-errors`) is a closed shape. There is no field that
  forwards arbitrary data, and no collection path exists for `localStorage`, cookies, form
  values, session tokens, or user identifiers — because that code was never written, not
  because a check rejects it at runtime.
- `sanitizeUrl` keeps only origin and pathname from any URL an `ErrorReport` carries; the
  query string and hash are discarded wholesale, unconditionally, never inspected. This is
  a stronger guarantee than an allowlist of "safe" parameter names, because that is exactly
  the list nobody keeps current — emails and tokens live in query strings often enough that
  the only defensible default is discarding all of it.
- `context` (`@sentra/plugin-errors`) and `attributes` (`@sentra/flags`'s `FlagContext`)
  are both allowlist-only: a key not named in `allowedContextKeys` or
  `allowedAttributeKeys` is dropped before it ever reaches a sink or a source. With no keys
  named, nothing is forwarded at all — the safe default is "nothing crosses the seam"
  rather than "everything except what a maintainer remembered to exclude." `FlagContext`
  itself carries no identity field beyond an adopter-supplied `stableId`, which the type's
  own documentation requires to be opaque.

**2. Best-effort — defence in depth, explicitly not load-bearing on its own.**

- `redact()` scrubs identifier-shaped substrings — emails, bearer tokens, long digit runs,
  free-form query strings — from an `ErrorReport`'s `message`, `stack`, and any allowlisted
  **string** context value. Pattern matching over prose cannot be proven complete and must
  not be treated as though it were: a value that does not match one of `redact`'s patterns
  passes through unchanged.
- An allowlisted **non-string** context value (a number or boolean) is never passed through
  `redact` at all. For those, the allowlist is the entire guarantee — allowlisting a numeric
  key that happens to hold a card number ships it unredacted, and the fix is to not
  allowlist that key, not to expect `redact` to catch it after the fact.

The ordering matters: a reviewer checking whether either package can leak an identifier
should check the closed shape and the allowlists first, because those are the checks that
hold even if `redact`'s patterns are incomplete or a call site's allowlist entry is applied
to a value the maintainer misjudged.

## Consequences

**What this buys:** an adopter who installs a vendor behind `ErrorSink` or `FlagSource`
does not have to audit that vendor's data-handling practices to know what left the
browser — the answer is fixed by the closed shape and the two allowlists, independent of
which vendor is behind the seam. Neither package needs a vendor-specific redaction
integration; the guarantee sits in front of every vendor equally.

**What this costs — the honest list:**

- **Data protection and minimisation.** `redact`'s pattern coverage is finite and stated
  as best-effort; an adopter who allowlists a context key without checking what values
  reach it can still ship something identifying through a string field `redact`'s patterns
  do not happen to match, or through a number/boolean field `redact` never inspects at all.
  The allowlist is a permission gate, not a content inspector — it does not know what value
  will occupy an allowlisted key at every call site in an adopter's codebase.
- **Access control for the override gate.** `@sentra/flags`'s `allowOverrides` lets any
  visitor who can edit their own URL query string or `localStorage` flip a flag for
  themselves once enabled, and a crafted link can do it to anyone who opens it. The
  package's own default is `false`, and its documentation states this must never be `true`
  in production — but that is a documented convention the package can recommend, not a
  runtime check the package can enforce against a caller who sets it to `true` anyway.
  Nothing in `@sentra/flags` inspects the environment it is running in.
- Neither guarantee extends past the browser boundary this package instruments. Once a
  report or a flag-evaluation payload reaches the vendor behind `ErrorSink` or
  `FlagSource`, that vendor's own retention, logging, and access-control practices govern
  it — this ADR's guarantees are about what leaves this codebase, not what a third party
  subsequently does with it.

## Alternatives not taken

- **A runtime schema validator rejecting disallowed fields, instead of a closed TypeScript
  shape.** Rejected: a closed shape enforced by the type system and the absence of a
  forwarding code path costs nothing at runtime and cannot be bypassed by a call site that
  compiles. A runtime validator would add a dependency and a code path that itself becomes
  something to keep correct, to catch a class of mistake the type system already makes
  unrepresentable for anyone who does not reach for `as any`.
- **A blocklist of known-sensitive key names, instead of an allowlist.** Rejected for both
  `allowedContextKeys` and `allowedAttributeKeys`: a blocklist's safe default is
  "everything, except what a maintainer remembered to name," which degrades silently as an
  adopter's own code grows unless the blocklist is actively maintained. An allowlist's safe
  default — nothing, until a key is deliberately named — degrades safely: an omission
  under-forwards rather than over-forwards.
- **Treating `redact` as sufficient on its own, with no allowlist.** Rejected: pattern
  matching over free-form strings is inherently incomplete, and relying on it alone would
  mean the guarantee's strength varies with how well `redact`'s patterns happen to match an
  adopter's data, rather than being fixed by what the adopter chose to allowlist. Layering
  the allowlist underneath keeps the strong guarantee (closed shape, allowlist) independent
  of the weak one (pattern matching), rather than letting the weak one carry the whole
  claim.
