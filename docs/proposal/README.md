# Sentra — a base platform for Vue product teams

**Classification: PUBLIC**

This document is the proposal itself. Every factual claim it makes has a row in
[claims.md](./claims.md) naming the command that proves it and the CI job that runs that
command on every push. Where a number would matter — a test count, a package count, a
bundle size — this document names the command that prints the current value instead of
writing the value down, because a number in prose has no runner and goes stale the moment
the thing it describes changes.

## The problem

Every product team that starts a new Vue front end re-decides the same handful of things,
usually under deadline pressure and usually differently from the team next to it: what a
design token is and how it reaches CSS, whether the button component announces its state
to a screen reader, whether an analytics call can leak a field nobody reviewed, whether a
security control like `v-html` sanitisation is a convention someone remembers or a lint
rule that fails the build. None of these are hard problems in isolation. The cost is that
they are solved — or not solved — independently, team by team, and a gap in one team's
version is invisible until an incident or an audit finds it.

A shared foundation only helps if two things are both true: teams can build on it without
carrying code they do not want, and the guarantees it makes are ones a reader can verify
rather than take on faith. Sentra is built to satisfy both. The second point is the harder
one, and it is why this proposal is structured around evidence rather than description —
see [claims.md](./claims.md) and [§5](#what-the-gates-guarantee) below.

## What Sentra is

Sentra is a pnpm/Turborepo monorepo split into two halves: a **base platform** that every
adopter keeps, and a **reference implementation** — a working storefront and an internal
ops console — that exists to prove the platform works and that an adopter is meant to
delete. The split is not a naming convention; it is a declared, machine-checked fact
(`sentra.role` in each workspace member's own `package.json`, `platform` or `reference`)
that drives an actual script (`scripts/strip-reference.mjs`) and is re-verified on every
push by CI actually running that script against a throwaway clone, not by inspecting the
dependency graph on paper. See [ADR 0007](../adr/0007-platform-and-reference-boundary.md)
for why the role lives on each package rather than in one central list, and for what a
naive dependency-graph check would have missed.

| Member | Directory | Role |
| --- | --- | --- |
| `@sentra/shell` | `apps/shell` | platform |
| `@sentra/ui` | `packages/ui` | platform |
| `@sentra/tokens` | `packages/tokens` | platform |
| `@sentra/result` | `packages/result` | platform |
| `@sentra/config` | `packages/config` | platform |
| `@sentra/shell-contract` | `packages/shell-contract` | platform |
| `@sentra/plugin-analytics` | `packages/plugin-analytics` | platform |
| `@sentra/storefront` | `apps/storefront` | reference |
| `@sentra/console` | `apps/console` | reference |
| `@sentra/sdk-commerce` | `packages/sdk-commerce` | reference |
| `@sentra/sdk-ops` | `packages/sdk-ops` | reference |

Each row's own README states its role in the same words as this table and links back to
[§6](#adopting-it) for the removal procedure. Run `node scripts/workspace.mjs --check`
(wired into CI as `pnpm verify:roles`) at any time to see the current membership and
confirm every member still declares a valid role.

## Architecture, and why

The host, `apps/shell`, is the only application a browser loads directly and the only
place a router or a `history` object lives; `apps/storefront` and `apps/console` are
Module Federation remotes composed into it at runtime. Three decisions make that
composition work, each recorded where it was made rather than restated here:

- **Why Module Federation, and what M4 left open** —
  [ADR 0001](../adr/0001-federation-plugin-choice.md).
- **How the shell discovers remotes at runtime rather than at build time**, so a remote's
  location is data (`remotes.json`) and not a compile-time constant —
  [ADR 0004](../adr/0004-runtime-remote-registry.md).
- **Which dependencies are shared as singletons across the federation boundary, and why
  this workspace's own `@sentra/*` packages are handled differently** — including the full
  injection-key inventory — [ADR 0005](../adr/0005-federation-shared-singletons.md).
- **How the shell and a remote exchange information without one importing the other** — a
  typed event bus (`ShellBus`) rather than direct imports, so the shell never depends on a
  remote's internals — [ADR 0006](../adr/0006-cross-remote-communication.md).

`@sentra/shell-contract` is the typed spine underneath all four decisions: the
`RemoteModule` interface a remote registers, the `ShellBus` event map, and the manifest
schema the shell validates `remotes.json` against before trusting anything in it. It is a
platform member, not a reference one, because every adopter needs the contract regardless
of which remotes they end up composing.

## Batteries included, and not

Sentra draws a hard boundary between what it ships and what every adopter must still
supply themselves. Overstating the first list is worse than a short list, because an
adopter who discovers a missing piece after committing to the platform has a worse day
than one who read an honest list up front.

**What you get:** a design-token pipeline with a generated CSS output
(`@sentra/tokens`); an accessibility-gated Vue 3 component library (`@sentra/ui`);
schema-validated, allowlist-only analytics as a Vue plugin (`@sentra/plugin-analytics`);
the federation host, its runtime remote registry, and the typed contract remotes register
against (`apps/shell`, `@sentra/shell-contract`); shared tool configuration
(`@sentra/config`); a CSP generated from the same manifest the shell loads remotes from; a
remote-integrity check that refuses to register a remote whose bytes do not match its
published digest; and five CI gates — CSP, integrity, Lighthouse budgets, bundle-size
budgets, and a dependency-audit allowlist — each with a stated boundary in
[§5](#what-the-gates-guarantee) below.

**What you must still build:**

- An authentication backend or identity provider integration.
- Internationalisation.
- Server-side rendering or static generation.
- An error-tracking or APM vendor.
- A design system beyond primitives and tokens.
- An API gateway or a BFF.
- A CMS integration.
- Deployment and hosting configuration.
- A feature-flag backend.

The reference implementation demonstrates one way to fill some of these gaps — a commerce
SDK, a mock-first testing story, an ops console — but demonstrating one way is exactly why
it is deletable rather than load-bearing: `@sentra/sdk-commerce` and `@sentra/sdk-ops` are
`reference`-role, not `platform`-role, precisely so that adopting Sentra does not mean
adopting Shopify or this particular ops backend.

## What the gates guarantee

Five CI gates were added on top of build/typecheck/lint/test in this milestone. Each has a
real, stated boundary — what it actually measures, and what it would pass on even if the
thing it is meant to protect were broken or absent. The general test behind every entry
below, and the full account of how it was applied, is
[ADR 0009](../adr/0009-gate-policy.md): *remove the thing being asserted about — does the
assertion still hold? If yes, the assertion was never actually about that thing.*

- **Content-Security-Policy (`pnpm verify:csp`, `apps/shell/e2e/csp.spec.ts`).** Proves the
  policy is generated from the same manifest the shell loads remotes from, so it cannot
  drift into a second, hand-maintained list. It does **not** prove `frame-ancestors`,
  `report-uri`, or `report-to` are enforced: CSP delivered via a `<meta>` tag cannot carry
  any of the three, Chrome says so in its own console diagnostic, and an operator must
  serve `apps/shell/dist/csp-headers.txt`'s content as a real HTTP header to get them — a
  manual step this build cannot force. See
  [ADR 0008](../adr/0008-remote-integrity-and-csp.md).
- **Remote integrity (`apps/shell/src/registry/*.test.ts`,
  `apps/shell/e2e/integrity.spec.ts`).** Proves a remote whose fetched bytes do not match
  its published SHA-384 digest is never registered. It does **not** close a
  time-of-check/time-of-use gap: the verifier fetches and hashes an entry once, and the
  federation loader fetches the same URL again to actually import it, so a server that
  changes its response between those two fetches defeats the check. This is a disclosed,
  permanent limitation of a hash check performed outside the browser's native
  Subresource-Integrity mechanism, not an oversight — see ADR 0008's account of why
  browser-native SRI is architecturally unreachable for this codebase's federation type.
- **Lighthouse budgets (`pnpm verify:lighthouse`).** Proves resource-summary ceilings and
  a pinned accessibility floor on every push; lab timing metrics
  (`largest-contentful-paint`, `total-blocking-time`, `cumulative-layout-shift`,
  `categories:best-practices`) are reported but not enforced, because a hard threshold on a
  shared CI runner produces failures nobody trusts, and an untrusted gate is the one that
  quietly acquires `continue-on-error: true` and never fails again. Several of the numbers
  this gate checks against are ratchets against a known defect, not targets, and are named
  as such rather than presented as standards: the shell's two `resource-summary` assertions
  are asserted at zero and cannot fail under the mocked build no matter what the app ships,
  because MSW's synthesised responses always report a transfer size of zero regardless of
  content; the storefront's layout-shift budget is pinned at 0.35 to tolerate a real,
  measured shift of 0.2960 whose source was not isolated within this milestone; the
  storefront's accessibility budget is pinned at 0.98, not 1, for one confirmed
  `heading-order` violation at `packages/ui/src/components/ProductCard/ProductCard.vue:78-83`
  (an `<article> → <button> → <h3>` structure with no intervening `<h2>`); and the shell's
  DOM-size floor of 14 is a sanity floor derived from a *broken* page's 9-element
  measurement during calibration, not a measured minimum of the shell's own real content.
  Full derivations, and the semantics of failing on any of three collected runs rather than
  only the one Lighthouse marks representative, live in ADR 0009 rather than repeated here.
- **Bundle-size budget (`pnpm verify:bundle-size`).** Proves the aggregate JS and CSS
  payload stays under a rename-proof ceiling that survives a hashed chunk filename changing
  between builds, and correctly distinguishes a reference app that was deleted on purpose
  (a supported state) from one that should exist but was never built (a broken run) —
  neither of which a generic, off-the-shelf budget tool has a concept of. It does not prove
  the cache-restore path for every package's build output has been exercised: Turborepo's
  cache-hit replay for `@sentra/sdk-commerce`'s generated schema output is correct by
  construction but untested, because that package's generated files live inside its own
  input set, leaving no scenario where inputs are unchanged and outputs are missing. The
  generated files are committed, so nothing depends on the restore path for correctness —
  but the path itself has not been exercised, and this document says so rather than
  claiming otherwise.
- **Dependency audit allowlist (`pnpm verify:audit`).** Proves an unreviewed high- or
  critical-severity advisory fails the build, and that an accepted advisory's exemption
  expires on a fixed date **whether or not the advisory itself is still reported** — an
  expiry nobody owns is just a scheduled build break, so `security/README.md` states
  plainly that a maintainer is expected to meet the date. It does not mean zero advisories:
  one moderate-severity finding (`uuid`, reported as `GHSA-w5hq-g745-h8pq`) sits below the
  gate's high/critical threshold and is left unaddressed deliberately, because a
  repository-wide override would move consumers pinned across two major versions to settle
  a non-blocking finding. The one entry currently on the allowlist
  (`extract-zip`, `GHSA-jmr9-qjv8-65gv`) expires 2026-11-28 regardless of advisory status by
  the same design.

Two findings from this milestone belong here because they are instances of the identical
defect class — a check able to pass while verifying nothing — appearing outside a CI gate
proper. First, `@sentra/ui`'s build once emitted type declarations through a plugin that
type-checked with plain `tsc`, which cannot resolve `.vue` module imports: it reported
eleven "cannot find module" errors, emitted usable declarations for five of the package's
eighteen exported modules, and still exited `0`, because nothing in this workspace actually
consumes `packages/ui/dist` — every consumer resolves `@sentra/ui` to its source via the
package's own `exports` field, so a broken declaration build was invisible to every other
check. It is fixed (`vue-tsc -p tsconfig.build.json`, which understands single-file
components and propagates a real exit code), and the account of the mechanism lives in
ADR 0009. Second, an implementation brief for an earlier task predicted a test would fail
before the feature existed; it passed instead, vacuously, because the element the test
queried for did not exist yet to query. The test that shipped is load-bearing — a mutation
proved it — but the episode is the same defect class appearing inside a planning document,
not only inside code, and is recorded here rather than quietly corrected out of the
record.

One more limitation belongs in this section even though it guards no CI gate: the
no-numbers-in-prose rule that keeps this document's own claims from going stale (see the
opening paragraph above) is enforced by review and by a hand-run sweep —
`rtk proxy grep -rniE "\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[0-9]{1,4}) [a-z]+s\b" README.md docs/proposal packages/*/README.md apps/*/README.md`
— not by anything CI checks. The sweep's matches are noisy by construction: a number
followed by a plural word catches both an inventory assertion that goes stale the moment a
repository artifact is added or removed, and ordinary prose that states a logical structure
or refers back to something just named — "two things are both true," "these same two
attributes." Separating the two requires reading each match in its sentence; there is no
pattern that keeps the first kind and drops the second without an allowlist, and an
allowlist built to suppress legitimate prose is more machinery than a documentation rule is
worth today. So this rule holds only as long as a reviewer keeps applying it — nothing in
CI fails if it lapses.

## Adopting it

Clone the repository, then decide whether you want the reference implementation at all.
If not:

```bash
node scripts/strip-reference.mjs
pnpm install --no-frozen-lockfile
```

This deletes every `reference`-role workspace member, the reference-owned documentation
directories and files named in root `package.json`'s `sentra.referenceDocs` (currently the
feasibility review under `docs/prd-feasibility` and
[ADR 0003](../adr/0003-vendored-schema-and-mock-first-commerce.md), whose decision only
exists because the reference commerce app exists), and the reference-owned Lighthouse
config named in `sentra.referenceConfigs`. It also prunes `apps/shell/dist/remotes.json`
and `security/csp-sources.json` of reference-owned entries, so the shell's CSP does not
keep naming an origin that no longer serves anything. `pnpm-workspace.yaml` needs no edit —
it globs `packages/*` and `apps/*`, so a deleted directory simply leaves the workspace.

What to change first: the shell's own branding and copy (`apps/shell`), the CSP's
`security/csp-sources.json` entries you actually need for your own backend, and the shared
singleton versions in each remaining `apps/*` package's `vite.config.ts` if you are not
starting from this repository's pinned `vue`/`vue-router`/`pinia` versions (see
[ADR 0005](../adr/0005-federation-shared-singletons.md)). The escape hatches an adopter
who keeps building on the platform is most likely to need — how a platform package stays
generic over a reference package's absence, via `optionalDependencies` plus an existence
check rather than a special case — are documented with the concrete places they were
needed in [ADR 0007](../adr/0007-platform-and-reference-boundary.md).

The deletion is not merely described here: `.github/workflows/ci.yml`'s `platform-only`
job performs it, in a throwaway clone, on every push, and then rebuilds, typechecks,
lints, and tests the result — see [claims.md](./claims.md) for the exact commands and
what each one currently does and does not prove.

## What it costs

A federation host is more operational surface than one SPA. `apps/shell` now owns a
runtime remote registry, a generated CSP, and a remote-integrity check that must run
before every deploy that changes a remote's bytes (`scripts/hash-remotes.mjs`) — none of
which a single-application deployment needs to think about at all.

The shared-singleton design ([ADR 0005](../adr/0005-federation-shared-singletons.md))
means `vue`, `vue-router`, and `pinia` cannot be upgraded independently by whichever team
owns a given remote: a version skew across the federation boundary on a singleton
dependency is a runtime defect, not a type error, so upgrading any of the three is a
platform-wide coordination event rather than one team's package-lock bump.

The gates cost CI minutes and occasionally block a merge on a budget rather than a bug: a
bundle-size regression, an accessibility score one hundredth below its pin, or an audit
allowlist entry reaching its expiry date all fail the build even when nothing about the
change under review is wrong. That is a deliberate trade — see
[ADR 0009](../adr/0009-gate-policy.md) for why an unenforced-but-trusted gate was chosen
over an enforced-but-eventually-disabled one — but it is a real cost, paid on every push,
not only when a gate catches something real.

The `tmp` package is pinned via a `pnpm.overrides` entry in root `package.json` to resolve
two supply-chain advisories reached only through a devDependency this repository does not
control directly. The override's rationale lives in a `$comment` key placed as a **sibling**
of `overrides`, never nested inside it — every key nested under `overrides` is read by
pnpm's resolver as a package-name selector, so a `$comment` placed there would be
interpreted as "override the package literally named `$comment`." This is a named
supply-chain risk-management decision, not a style choice; the full reasoning is in
[ADR 0009](../adr/0009-gate-policy.md).

`packages/ui`'s build step also type-checks and emits declaration files into `dist/` that
no consumer in this workspace resolves against — every internal consumer resolves
`@sentra/ui` to its source. That build time is spent for publish-readiness an adopter who
never publishes the package to a registry does not need, and is a real, ongoing cost of
keeping the package publish-ready rather than a defect.

## How decisions get recorded

Architecture and policy decisions live as ADRs in [`docs/adr/`](../adr/), one file per
decision, each stating what it decides, the alternatives not taken, and what the decision
costs as well as what it buys. ADRs are not edited to reflect a later change of mind — a
reversed decision gets a new ADR that supersedes the old one, so the record of what was
decided and why at the time never silently disappears. Consult
[ADR 0001](../adr/0001-federation-plugin-choice.md) through
[ADR 0009](../adr/0009-gate-policy.md) for the specific decisions this proposal links to
throughout; none of them are restated here.
