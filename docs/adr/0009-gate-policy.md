# ADR 0009 — Gate policy

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decides:** the hard-versus-warn split across M5's CI gates, where the bundle-size and
  audit gates live and why, and the general principle — with every instance M5 found of
  it — that a check able to pass while measuring nothing is not a check.

## Context

M5 added five CI gates on top of M4's build/typecheck/lint/test: a Content-Security-Policy
generator (ADR 0008), a remote-integrity verifier (ADR 0008), a bundle-size budget, a
dependency-audit allowlist, and Lighthouse performance/accessibility budgets. The
proposal's argument is that these gates make claims a reader can trust. That argument only
holds if the gates themselves are honest about what they do and do not cover — a milestone
that oversells a green checkmark is worse than one with no gate at all, because a reader
has no way to tell a real gate from a decorative one without opening the source. This ADR
is the record of what each gate actually asserts, and of a defect class M5 found
repeatedly: a check that would still report success if the thing it is checking were
deleted.

## The hard-versus-warn split

`.github/workflows/ci.yml`'s `lighthouse` job states the rule in its own comment:
"Resource budgets are enforced; lab timing metrics are reported only. A timing threshold
on a shared CI runner produces failures nobody trusts, and an untrusted gate acquires
`continue-on-error: true` and never fails again. Enforcing only the deterministic half is
what keeps this gate alive." Concretely, in `lighthouserc.json` and `lighthouserc.
reference.json`: `resource-summary:*:size`, `resource-summary:third-party:count`, and
`categories:accessibility` are `error`; `largest-contentful-paint`, `total-blocking-time`,
`cumulative-layout-shift`, and `categories:best-practices` are `warn`. The split is not
about which metric matters more — a real layout shift or a slow paint matters — it is
about which metric is *deterministic enough on a shared CI runner to justify blocking a
merge*. The failure mode this prevents is specific and worth naming: a hard gate that
fails on scheduler jitter gets `continue-on-error: true` bolted onto it by whoever is
blocked, and from that point on the gate is decoration — it will never fail again,
regardless of what the app does. A gate an adopter cannot trust to fire only on a real
regression gets disabled the first time it cries wolf, and stays disabled.

## Why the bundle-size gate is in-repo rather than a dependency

`scripts/check-bundle-size.mjs` is hand-written, not an off-the-shelf budget tool, for two
reasons specific to this platform's shape. First, most of a federated bundle's weight
lives in bundler-generated chunk names that Module Federation and Vite construct at build
time and that no glob can name stably across builds — the `$total:js` / `$total:css`
aggregate keys exist because a rename-proof total is the only budget that survives a
hashed-filename chunk being renamed between builds, and a generic tool built around named
file globs has no equivalent. Second, `classify()`'s three-way present/unbuilt/absent
distinction is wired directly to `strip-reference.mjs`'s role model from ADR 0007: an
absent app directory is a supported, correct state (the reference half was deleted) and
must not fail the same way an *unbuilt* directory does (a real broken CI run). A generic
bundle-size tool has no concept of a workspace member that is allowed to not exist; this
platform's gate needed one built in.

## Raising a budget is a recorded event, not a silent edit

A resource budget that can be edited to match whatever the build currently produces is not a
budget. But a budget that may never move is worse in a different way: it turns every
deliberate, justified increase into pressure to either abandon the feature or quietly disable
the gate — and a gate disabled once stays disabled, which is the failure this ADR's opening
warns about. The policy is therefore neither "never raise" nor "raise on red", but: **a raise
is allowed, and it must leave behind enough of a record that a later reader can disagree with
it.**

Three things make a raise legitimate. The new number must be derived by the rule already
stated in `bundle-budgets.json`'s `$comment` (round the measurement up to the next whole
kilobyte, add ten percent, round any fractional byte up) rather than chosen to clear the
measurement by a comfortable margin. The measurement must be recorded with the commit it was
taken at, because a byte count without a commit cannot be re-derived. And the *cause* of the
growth must be named, so that the raise can be challenged on its merits — "this app now ships
three more plugin runtimes" invites a reader to ask whether it should, whereas "the budget was
too tight" invites nothing.

**M6 raised exactly one key under this policy** — `apps/console`'s `assets/index-*.js`, from
5632 to 6759, measured at 5898 bytes gzipped at `f2f1e24` — **and then withdrew it before the
milestone shipped.** The derivation, the commit, the cause, and the two entry chunks that grew
without breaching are all recorded in that file's `$comment`. The argument below is the record
of why the raise was made, kept intact rather than deleted, because a policy that only preserves
the raises it still agrees with preserves nothing. What withdrew it is recorded at the end.

The case against a code fix is measured rather than argued. The largest available locale-side
saving is to stop shipping the Indonesian half of `@sentra/ui`'s catalogue, which the console
never selects — its locale and `fallbackLocale` are both fixed at `'en'`
(`apps/console/src/main.ts:125-126`). That saving cannot be taken from the app side:
`uiMessages` is a single object literal (`packages/ui/src/i18n/index.ts:16`), so narrowing the
install to `{ en: uiMessages.en }` still constructs the whole object and saves 5 bytes.
Removing `id` from the shared package itself — a change to a platform package on behalf of one
consumer — brings the entry to 5764 bytes, still 132 over the old budget: `id.json` gzips to
254 bytes standalone but costs only 134 inside the chunk, because `en`'s identical key names
have already primed the compression dictionary.

Two candidates were searched, not one. The second is to curate the catalogue's *contents*
rather than its locales: console's own views reference only `DataTable`
(`apps/console/src/views/OrdersView.vue:5`), three of the catalogue's seven keys. That fix is
capped by the same structure and then by arithmetic — `en.json` is also a single JSON object
literal, so unused keys inside it are no more droppable than an unused locale is, and four keys
of seven cannot exceed the 134 bytes the entire other half of the catalogue costs. (Whether the
`Toast` and `Combobox` keys reach the chunk through `@sentra/ui`'s barrel export regardless is
a separate question, not measured here.)

So the claim is a bound, not an exhaustive search of all possible fixes: the ceiling of both
available candidates was measured and falls 132 bytes short, and the one remaining option —
lazy per-locale loading — is placed outside M6's scope by ADR 0011. That is what makes the
raise the honest remedy rather than the convenient one.

## The raise was withdrawn, and the reason is not the one the argument above anticipated

Re-measured at `e9c72dc`, `apps/console`'s entry chunk is **4930 bytes** — under the original
5632 budget, with the rule regenerating exactly that number from the new measurement. The key
is back to 5632 and M6 ships **no** budget raise.

Nothing above was acted on. Nothing was optimised for size. The entry shrank as a side effect
of fixing the final review's Critical finding: `@sentra/flags` was never installed in console's
federated entry (`apps/console/src/federated/register.ts`), so under the shell `useFlags()`
fell through to `NULL_FLAGS` and no feature gate could ever open. Installing it there gave the
flags runtime a *second* importer alongside `apps/console/src/main.ts`, and Rollup hoists a
module shared by two entry points into a shared chunk instead of inlining it into each. The
runtime left the entry for `federated-*.js`, which carries no glob budget of its own and is
covered by `$total:js`.

That was verified in the built output rather than inferred from the byte drop, because a
968-byte fall is equally consistent with "the runtime moved" and with "something was dropped
altogether": `'orders.bulkActions'` and `fnv1a`'s offset basis `2166136261` are both present in
`federated-*.js` and in neither case in `index-*.js`, while `ui.dataTable.sortBy` is present in
`index-*.js` and absent from `federated-*.js`. The catalogue never moved, so the locale analysis
above remains true — it is simply no longer load-bearing, because the overage it explained no
longer exists.

Two things follow. First, the measured bound above was **right and still irrelevant**: it
correctly established that no locale-side fix could close a 266-byte gap, and the gap closed
anyway through a change made for unrelated correctness reasons. A bound on the fixes you
thought to look for is not a bound on the outcomes available — which is the same limit this
document already names about itself one paragraph earlier, arriving from the other direction.
Second, the restored budget now sits 702 bytes above the measurement, so removing the federated
flags wiring would push the runtime back into the entry and fail this gate. That is an accident
of chunking, not a guard: the test that actually holds the Critical closed is
`apps/console/src/federated/register.test.ts`, and this budget must not be cited as a substitute
for it.

An earlier revision of this section named the wrong cause: it said the console shipped its own
`en`/`id` catalogues, and cited ADR 0011's lazy-splitting exclusion as though it also excluded
dead-locale elimination. Both were false, and the correction is left visible here rather than
rewritten away, because a policy demanding a challengeable record cannot make its own errors
disappear.

What this policy deliberately does not do is distinguish a raise from a regression by size.
266 bytes over is not evidence of anything; a small breach caused by an accident is worse than
a large one caused by a shipped feature. The distinguishing question is whether the growth was
intended and is explained, which is a question about the record, not about the number.

## The audit allowlist: expiry fails even when the advisory is gone

`security/audit-allowlist.json` accepts an advisory only with a `reason` and an `expires`
date; `scripts/check-audit.mjs`'s `reconcile` fails the build once `expires` has passed,
**whether or not the advisory is still reported**. The design is deliberate, stated in
`security/README.md`: "an entry that outlives its deadline is a decision nobody has
revisited, and the build is the only place that reliably asks." An advisory disappearing
from the registry's database is not the same fact as someone having confirmed the
dependency was actually upgraded or replaced — the allowlist entry existing at all means a
human decided to defer, and the expiry is what forces that deferral to be revisited rather
than to become permanent by default. The one entry that exists today,
`GHSA-jmr9-qjv8-65gv` against `extract-zip` (reached only via `.>@lhci/cli>lighthouse>
puppeteer-core>@puppeteer/browsers>extract-zip`, a devDependency that runs only in CI),
expires 2026-11-28 because no patched release exists yet. The gate will fail on that date
regardless of whether a patch has shipped by then — that is by design, not an oversight,
and `security/README.md` says so plainly so a maintainer is expected to meet the date
rather than discover the break.

`pnpm audit`'s reported count and this platform's own numbers can look inconsistent
without being wrong: `metadata.vulnerabilities` counts findings — dependency *paths* to an
advisory — not distinct advisories. `tmp` (the package behind the two supply-chain
overrides below) is reached twice, once directly through `@lhci/cli` and once through
`inquirer > external-editor`, so its two advisories contribute four path-counted findings
where two advisory identifiers exist. A reader comparing "two advisories" against a
six-or-four-style vulnerability count from the raw tool should not conclude the gate is
under- or over-reporting; the two numbers answer different questions.

One advisory is knowingly left unaddressed below the gate's own threshold, worth stating
so a green `verify:audit` is not mistaken for "zero advisories reported at all":
`GHSA-w5hq-g745-h8pq` (`uuid`, moderate) is below the `high`/`critical` threshold
`check-audit.mjs` blocks on, and is left alone deliberately — a repository-wide `uuid`
override would move consumers currently pinned across two major versions of `uuid` to
settle a non-blocking finding, which is a worse trade than leaving it reported and
unblocking.

## The supply-chain override, and why its rationale sits beside `overrides`, not inside it

Root `package.json`'s `pnpm.overrides` pins `tmp` to `^0.2.6`. Two advisories —
`GHSA-ph9p-34f9-6g65` (high) and `GHSA-52f5-9888-hmc6` (low) — land on `tmp`, reached only
through `@lhci/cli`, a devDependency neither used directly by application code nor owned
by a package this repository controls. With no direct dependent to upgrade, `pnpm.
overrides` was the only lever available. The rationale for the override lives in a
`$comment` key that is a **sibling** of `overrides`, not a value nested inside it, because
every key nested under `overrides` is read by pnpm's resolver as a package-name selector —
a `$comment` key placed there would be interpreted as "override the package literally
named `$comment`," which is either a silent no-op or, worse, a real package name someone
registers later. Keeping the rationale as a sibling key is not a style preference; it is
what keeps the resolver from ever trying to parse prose as a dependency selector.

## Gate scripts get their own root Vitest project

`vitest.config.ts` at the repository root scopes a Vitest project to `scripts/**/*.test.
mjs` specifically because these scripts are plain Node programs run directly by CI steps,
not workspace members `turbo run test` ever sees. Without this project, the logic deciding
whether every other gate in this document passes or fails would be the one piece of code
in the repository with no test coverage at all — which is backwards for code whose entire
job is catching mistakes: a gate script that is itself wrong fails open, silently, and
nothing else in the pipeline is positioned to notice.

## The spine: a check that can pass while measuring nothing is not a check

The general test, applied throughout M5's gates: *remove the thing being asserted about —
does the assertion still hold?* If yes, the assertion was never actually about that thing.
M5 found seven distinct ways this happens, in roughly the order they get harder to see,
each one found only after CI had already gone green on the defective version:

1. **The file is absent.** A gate that globs an app directory the strip deleted has
   nothing to measure. `check-bundle-size.mjs`'s `classify()` exists to tell this apart
   from an app that should exist but was never built — an absent directory is skipped, an
   unbuilt one fails — and a run that skips every app still fails overall ("no app was
   measured — every budgeted directory was absent"), because skipping every budget is
   indistinguishable from a wrong working directory or a broken strip.
2. **The aggregate is empty.** `0 <= any budget` is true for every positive budget, so an
   aggregate summed over zero files silently satisfies every ceiling — the gate that
   measures the most, in appearance, passes the loudest while checking nothing. Both
   `evaluate`'s per-pattern "matched no file" guard and its `$total:*` "contributing.length
   === 0" guard in `check-bundle-size.mjs` exist for exactly this: a budget or a total that
   matched zero files is a failure, not a pass, because a smaller-than-expected build can
   only ever cost less, and a check phrased as an upper bound cannot tell "smaller" from
   "absent."
3. **The rule is absent.** A config key that no code path actually reads is
   indistinguishable, by every downstream signal, from a rule that was enforced and
   satisfied. `unknownBudgetKeyFailures` in `check-bundle-size.mjs` exists because a
   `$`-prefixed key that is not a recognised total (a typo like `$total:jss`, or a
   plausible addition nobody wired up) matches no glob, trips no per-file guard, and is
   compared against nothing — it reads as coverage in the budgets file while the build
   enforces none of it.
4. **The value is absent, present as text.** A hand-edited JSON file can carry `"5632"`
   where a number belongs, or a stray formatter artifact can leave `null`. `NaN <= x` and
   `x <= NaN` are both `false` in JavaScript, so a malformed numeric budget **fails
   closed** — the one level in this progression that looks like a working gate, because it
   does fail, just never for the reason its message would suggest. `invalidBudgetValueFailures`
   in `check-bundle-size.mjs` rejects a quoted or non-finite value outright rather than
   coercing it, naming the malformed value as the actual problem instead of letting it
   surface as a mysterious budget failure on an unrelated file.
5. **The subject is absent.** Two independent instances, one obvious in hindsight and one
   found late:
   - Zero CSP violations reported on a page that was never served with a CSP at all. A
     Playwright assertion counting `securitypolicyviolation` events proves nothing about a
     page that has no policy to violate; the listener must be attached before navigation
     (`page.addInitScript`, not a post-`goto` handler) and the page under test must
     actually carry the generated policy, or "zero violations" is vacuously true.
   - **`@sentra/ui`'s build emitted type declarations via `vite-plugin-dts`, which
     type-checks with plain `tsc`.** `tsc` cannot resolve `*.vue` module imports on its
     own. The plugin reported eleven `TS2307` "cannot find module" errors against `.vue`
     imports, emitted declarations for only five of the package's eighteen exported
     modules, and **still exited 0** — the build's success signal was true whether or not
     the package had usable types. This was invisible for as long as it was because
     `@sentra/ui`'s `exports` field resolves `"."` to `./src/index.ts`, not to `dist/` —
     every consumer in this workspace typechecks against source directly and never
     imports the declarations the broken step produced, so nothing downstream ever
     exercised the missing thirteen modules. Fixed by replacing the plugin step with
     `vue-tsc -p tsconfig.build.json` in `packages/ui/package.json`'s `build` script:
     `vue-tsc` understands single-file components, emits declarations for all eighteen
     modules, and — the load-bearing property — propagates a non-zero exit when it cannot.
6. **The value is valid but means something else.** Silent coercion or a value that is
   syntactically fine but semantically out of range. `check-audit.mjs`'s `expires` date
   validation is the concrete instance: the regex `^\d{4}-\d{2}-\d{2}$` proves the shape,
   not that the calendar date exists. `"2026-02-30"` matches the shape and parses as a
   `Date` — JavaScript's `Date` silently rolls the overflow forward to 2026-03-02 instead
   of rejecting it — producing a real, non-`NaN` timestamp that a bare `Number.isNaN`
   check would accept. Without the round-trip comparison (`reconcile` re-derives year,
   month, and day from the parsed `Date` and checks they match the input), an entry with
   this typo would be judged neither malformed nor expired and would silence its advisory
   indefinitely — the exact failure this allowlist exists to prevent, reachable by a typo
   more plausible than an intentionally invalid date string.
7. **The evidence is real but describes a different run.** `@lhci/cli` 0.15.1's
   filesystem target creates its `outputDir` (`.lighthouseci`) once and never cleans it,
   but fully overwrites `manifest.json` on every invocation. A guard reading every
   `*.report.json` file under `outputDir` — a directory listing — cannot tell this run's
   report from a leftover from a run months ago against a URL that no longer exists. A
   re-review falsified exactly that version of `scripts/check-lighthouse-dom-floor.mjs`:
   renaming a collected URL while leaving `domSizeFloor` keyed to the old one produced
   zero *fresh* reports for the new URL, but one *stale* leftover report for the old URL
   was enough to satisfy the vacuity guard and report success — on a page this run never
   measured. `manifest.json`, fully rewritten every run, is what the script binds to
   instead; a missing or unreadable `manifest.json` is now a hard failure, not an empty
   report list, because an empty list would sail past the same vacuity guard the same
   stale-file version did. **The general rule: a guard must bind to the run, not to the
   directory the run happens to write into.**

## Three points that make this a policy, not a taxonomy

- **Fails-open versus fails-closed is the severity boundary, but it governs the check, not
  the product.** A check that fails silently (levels 1–3, 5, 7 above) is worse than one
  that fails loudly for a slightly wrong reason (level 4, `NaN`'s false comparisons), and
  that ranking is real. It does not excuse a default build that produces a broken app: an
  adopter whose first deploy renders a white screen is not consoled by the fact that the
  integrity gate that would have caught a different problem failed closed correctly. Gate
  reliability and product correctness are separate axes, and this milestone's gates only
  ever address the first one.
- **Three distinct mechanisms produce the identical symptom** and need separate handling,
  not one fix applied to all three: a `NaN` comparison silently evaluating to `false`
  (level 4), a type coercion that turns a mistake into a technically-valid value, and a
  value that parses correctly but sits outside the range that makes it meaningful (level
  6's rolled-over calendar date). Treating all three as "bad input" and reaching for one
  generic validator misses that each requires its own check: `Number.isFinite`, an
  explicit type rejection, and a round-trip comparison respectively.
- **Some instances are latent by construction, not by mistake.** `<meta charset>` is only
  honoured within a document's first 1024 bytes, and this platform's generated CSP
  `content` attribute grows every time an adopter adds a remote origin or a
  `csp-sources.json` entry — so a build where the CSP tag happens to land before the
  charset tag today is correct today and becomes a defect on a future adopter's machine
  once their policy grows past the byte where charset detection silently kicks in.
  `injectMeta` in `scripts/generate-csp.mjs` is written against this directly: it inserts
  immediately after the charset declaration, not merely somewhere early in `<head>`.
  **Gates, and the code they check, should be written against the direction a file grows,
  not against its size at the moment the check was written.**

## Two process rules, earned by real rework

- **Turbo input hashing.** Any script that lives outside a package's own directory but
  writes into that package's build output is invisible to Turborepo's input hash by
  default. A stale artifact and the build log can then disagree, and `>>> FULL TURBO` — a
  cache hit — replays the stale log, which is the one that looks convincing because it
  looks like a successful run. This repository hit the same defect twice: once when
  `scripts/csp.mjs` and `scripts/generate-csp.mjs` (which write into `apps/shell/dist/`
  from outside `apps/shell`) were not in any package's input set, and again, one task
  later, when `scripts/hash-remotes.mjs` — which also writes into `apps/shell/dist/` —
  was fixed for the CSP scripts but not yet added itself, so a content-only change to the
  hashing script did not invalidate the cache and a plain `pnpm build` would have replayed
  a stale, pre-change `dist/remotes.json` while reporting success. Both were fixed the
  same way: added to `turbo.json`'s top-level `globalDependencies`, which currently lists
  `security/csp-sources.json`, `scripts/csp.mjs`, `scripts/generate-csp.mjs`, and
  `scripts/hash-remotes.mjs`. `globalDependencies` deliberately over-invalidates — every
  package's cache is invalidated by a change to any of these four files, more often than
  strictly necessary. The alternative, a per-task `inputs` array scoped to one package,
  was rejected because `inputs` *restricts* what Turborepo hashes for that task — it does
  not add to the default, it replaces it — so a scoped `inputs` array that omitted a
  file would silently stop hashing real application source for that task, making the
  exact defect this fix exists to close worse, not better.
- **A gate defect can appear only in the composition of two independently-correct
  changes**, not in either one alone, which means a review of each change in isolation can
  never find it. During planning, folding a webServer-startup optimisation (build once,
  reuse across a `process.env.CI` split) into the shell's Playwright config was checked
  against two things the change's own snippet did not show: the `hasReference` guard that
  makes the shell's E2E array conditional on the reference apps being present (correct on
  its own), and the remote-hash step from ADR 0008 needing to run regardless of which
  branch of that split executes. Had the hash step landed inside only one arm of the
  split, a pre-built tree would boot against an unhashed manifest with `requireIntegrity`
  silently satisfied by there being nothing to verify — level five of this progression
  (the subject is absent), reached not by writing a wrong assertion but by two tasks, each
  correct in isolation, composing into a gap neither one owns alone. Caught in plan review
  before the task that would have introduced it ran, specifically because the review
  re-ran its defect scan against the amended plan rather than trusting a scan performed
  once at the start.
- **Deliberate-failure checks are themselves assertions, and take the identical test.** A
  mutation aimed at proving `vue-tsc`'s exit code propagates through `@sentra/ui`'s build
  pointed an import at a non-existent `.vue` file. The build exited 1 — apparently
  conclusive — but the log contained zero `error TS` lines: Vite's own module *resolver*
  failed first, before the type checker ever ran, so the mutation proved that Vite fails
  on a missing file, which nobody doubted, and proved nothing about `vue-tsc`. Only a
  type-only defect — `export const __typeProbe: number = 'not a number'` — isolates the
  failure to the checker, because esbuild strips TypeScript types without checking them
  and Vite's build therefore cannot see this class of error at all; a red build in that
  case can only mean the type-checking step caught it. **A deliberate-failure check must
  fail for the reason under test, and the exit code alone cannot tell you which reason it
  was** — the log has to be read, not just the exit status.

## The Lighthouse budgets: what they assert, and what they do not

`lighthouserc.json` (the platform budget, run in every tree) and `lighthouserc.reference.
json` (the reference budget, deleted with `apps/storefront`) both used to carry a long
`$comment` deriving every number from a measured baseline. That prose is moved here in
full rather than copied, so there is one place these numbers' provenance lives; each
config now carries a one-line pointer back to this section. Duplicating it would have left
two copies free to drift, and the config copy is the one nobody remembers to update when a
number changes.

**Two budgets are permanently inert under the mocked build.** `resource-summary:image:
size` and `resource-summary:third-party:count` are asserted at 0 on the shell.
`transferSize` is what these assertions read, and MSW's `respondWith()` synthesises
responses in-process — the same request that reports `statusCode 200` and `resourceSize
11387` (its real decoded byte count) reports `transferSize 0` in the identical network
entry, because a Service Worker response never crosses Chrome's real network transport
regardless of the content it carries. These two assertions cannot fail under this build no
matter what the app ships; they are placeholders that become load-bearing only against a
real, unmocked backend, listed here so they are not mistaken for budgets that protect
anything today.

**The storefront's `cumulative-layout-shift` budget is pinned at 0.35 to tolerate a real,
pre-existing shift measured at 0.2960.** The number is a ratchet stop, not a target — it
prevents the shift from growing further while leaving the underlying defect in place. The
storefront's product-image `<img>` carries an explicit fixed-height container, ruling that
out as the cause; the actual source of the shift was not isolated within this milestone's
scope.

**The storefront's `categories:accessibility` budget is pinned at 0.98, not 1, for one
confirmed, specific reason:** a `heading-order` violation at `div.h-full > article.
overflow-hidden > button.focus-visible:outline > h3.text-sm` — a `ProductCard` title
rendering `<article> → <button> → <h3>` beneath `CollectionView`'s `<h1>` with no
intervening `<h2>`. Every other accessibility sub-audit on this page scores 1. The pin is
0.98 rather than 1 because setting it to 1 would make the gate permanently red for this
one pre-existing, located defect; fixing the heading order and raising the pin to 1 is a
follow-up outside M5's scope. The shell's own accessibility budget is pinned at the full 1
— this loosening is specific to the storefront page and its known defect, not a general
standard.

**The shell's `domSizeFloor` of 14 (`scripts/check-lighthouse-dom-floor.mjs`) exists
because `@lhci/cli` 0.15.1's assertion vocabulary is exactly `{minScore, maxLength,
maxNumericValue}` — there is no `minNumericValue`, so `lhci` itself cannot assert a lower
bound on anything, DOM size included.** Without a floor, a build that renders nothing
passes every `maxNumericValue` ceiling in the file trivially (level 2 of the progression
above) and `categories:accessibility`'s own `minScore` provides no substitute: a
syntactically valid, empty page scores a perfect 1.0. 14 was derived from the smallest
known-legitimate reading on this URL (18, the shell's clean `RemoteUnavailable` panel with
an empty manifest) and the smallest known-broken reading found in this codebase (9
elements, a router-miss page on a *different* app during that app's own Lighthouse
calibration) — set close to the proven-broken bound with headroom below the smaller
legitimate reading, so ordinary markup variation in the panel never risks a false failure.
It is a sanity floor derived from a broken page's measurement, not a measured minimum of
the shell's own real content, and should be read as exactly that.

**`isRepresentativeRun` semantics: undocumented in the tool, stated here.**
`check-lighthouse-dom-floor.mjs` fails if **any** of the three collected Lighthouse runs
per URL falls under its floor, not only the one run `lhci` itself marks representative.
This is the strictest available reading of "did this run measure the right page," chosen
deliberately: a page that renders correctly on two of three runs and falls to a broken
state on the third is exactly the flakiness this floor exists to catch, and averaging or
sampling one run would hide it. Neither `lighthouserc.json`'s nor `lighthouserc.reference.
json`'s own `$comment` ever stated this; it is recorded here so the choice is not left to
be reverse-engineered from the script's source.

**The floor has since caught a live regression, and its cause is an ordering hazard worth
naming.** `apps/shell/package.json` declares `@sentra/storefront` and `@sentra/console`
under `optionalDependencies` — deliberately, so `pnpm install` still resolves on a tree
where `strip-reference.mjs` has deleted them. Turbo reads an optional dependency as an
ordinary graph edge, so `@sentra/shell#test` inherits `^build` and rebuilds both remotes,
while `@sentra/shell#build` — the only task that runs `hash-remotes.mjs` — is not in the
`test` graph at all. Running `pnpm test` after a build therefore does two things at once:
it regenerates the remote bundles without `VITE_SENTRA_MOCKS` in the ambient environment,
and it leaves the shell's `dist/remotes.json` pinning digests for bundles that no longer
exist. A Lighthouse run against that tree scored `performance 0.99` and
`categories:accessibility 1` on a fourteen-element page whose only data request was a real
`401` from `demo-shop.myshopify.com`. Every `lhci` assertion passed; the DOM floor was the
sole failure, with the message it was written to produce.

**CI is not exposed to this, by an ordering that predates the discovery.** The `verify`
job builds at its `Build` step, runs every dist-reading gate immediately after, and only
then runs `Typecheck` and `Test` — so the desynchronised tree exists only after the last
gate that could be misled by it. The hazard is local: a developer who runs `pnpm test` and
then a gate, or a preview server, is measuring a different application than the one they
built. No new CI gate is proposed for it, because such a gate would have no reachable
failing case in CI — a check whose subject is absent, which is level 5 of the progression
above and precisely what this document argues against adding.

## Consequences

**What this buys:** every gate in this document has a stated boundary — what it actually
measures, what would make it pass without measuring anything, and, where one exists, the
follow-up that would close the gap. A reader auditing this platform can tell a live signal
(the shell's `categories:accessibility: 1`) from a placeholder (`resource-summary:image:
size: 0` under mocks) from a ratchet against a known defect (the storefront's CLS pin)
without reverse-engineering the difference from source.

**What this costs:** this document is long, and it will go stale the moment a gate's
numbers change without this ADR being updated alongside it — the same drift risk ADR 0007
and ADR 0008 name for a central role list or a hand-kept CSP origin list. Keeping it
accurate is a maintenance obligation this milestone is accepting deliberately, on the
argument that an inaccurate account of a gate is worse than no account at all.

## The honest closing point

This defect class — a check that would pass if the thing it checks were removed —
recurred **inside its own repair**, more than once, over the course of M5: the turbo
input-hashing gap was fixed for the CSP scripts and then found again, unfixed, for
`hash-remotes.mjs` one task later; and once it appeared not from any single change but
from the **composition of two independently-correct changes**, caught only because a plan
review re-ran its own defect scan against an amendment rather than trusting a scan run
once at the start. That recurrence, inside the very work meant to close it, is the actual
argument for these gates existing at all — not that any engineer here was careless, but
that this specific class of defect does not yield to care. A gate is what catches it when
care, demonstrably, did not.

## Alternatives not taken

- **A single generic "coverage" metric per gate (e.g., "N files checked") as a proxy for
  vacuity.** Rejected: a coverage count is itself subject to the same defect it would be
  meant to catch — a count of zero looks identical to a count that was never wired up to
  increment, which is exactly level 3 (the rule is absent) one level further down.
  Per-gate vacuity guards, each checking the specific invariant that gate depends on, were
  used instead.
- **`continue-on-error: true` on the Lighthouse timing metrics, to avoid the appearance of
  a permanently-warning gate.** Rejected — this is precisely the failure mode the
  hard/warn split exists to prevent from happening by a different route: a gate silenced
  by a blanket escape hatch is no longer measuring anything, warn-level or not.
- **A `readdir`-based scan of every `*.report.json` for the Lighthouse DOM floor.**
  Rejected after being falsified directly: it cannot distinguish this run's reports from
  every past run's leftovers in a directory `@lhci/cli` never cleans.
