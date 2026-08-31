# ADR 0011 — i18n as a seam, not a library adoption

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-31
- **Decides:** why `@sentra/i18n` is built on `Intl` rather than adopting `vue-i18n`, and
  what that decision explicitly leaves out.

## Context

`vue-i18n` is not installed anywhere in this workspace — not as a dependency of any
`packages/*` or `apps/*` member, and not transitively. Adopting it as the platform's
translation library would cost three things:

1. **A new dependency-audit surface.** Every runtime dependency this workspace adds is a
   new node `pnpm verify:audit` inspects; if `vue-i18n` or one of its transitive
   dependencies were ever reported with a high- or critical-severity advisory,
   `security/audit-allowlist.json` would need a new entry — a reason and an expiry date —
   before the build could pass again. This repository has not installed the package, so
   whether such an advisory exists today is unverified; the point is the structural cost
   of adding the dependency at all, not a specific claim about `vue-i18n`'s current
   advisory history.
2. **New bundle weight against a ceiling that is already tight.** Every app in this
   workspace is gated on the same 5632-byte gzipped stylesheet ceiling
   (`lighthouserc.json:21-24`, `lighthouserc.reference.json:21-24`). Measured at commit
   `841f2a35c666e8886d81f99c41dd495b98082883` — the tree this ADR was written against —
   the actual `resource-summary:stylesheet:size` Lighthouse reports, gzipped, three runs
   each, byte-identical across all three:

   | URL | Measured | Ceiling | Headroom |
   | --- | --- | --- | --- |
   | `http://127.0.0.1:4173/` | 5591 B | 5632 B | 41 B |
   | `http://127.0.0.1:4173/products/sentra-piece-2` | 5591 B | 5632 B | 41 B |
   | `http://127.0.0.1:4175/` | 5328 B | 5632 B | 304 B |

   The storefront pages are 41 bytes from failing outright. This number will already be
   stale by the time anyone reads it — every task lands more code — which is exactly why
   this ADR does not lean on it as a fixed fact. What does not go stale is the shape of the
   argument: a hard ceiling exists, every app is gated on it, and headroom on at least one
   of the three measured pages is measured in tens of bytes, not kilobytes. `vue-i18n`
   ships its own runtime and, in typical setups, component-level styling or slot markup
   that a from-`Intl` seam does not need at all; spending any part of a double-digit-byte
   headroom on a library whose CLDR-backed formatting `Intl.NumberFormat` and
   `Intl.DateTimeFormat` already provide natively is not a trade this milestone will make.
   A reader who doubts this number can re-run `pnpm verify:lighthouse:reference` and
   `pnpm verify:lighthouse` at the same commit and reproduce it.
3. **An unverified Symbol-key federation hazard.** ADR 0005 requires every `@sentra/*`
   injection key to be a plain string, because `inject`/`provide` resolve strings by value
   across independently-bundled Module Federation containers, while a `Symbol()` is only
   identical to itself within the one loaded copy of the module that created it. This
   repository has not installed `vue-i18n` and has not inspected its current injection
   mechanism, so whether it relies on `Symbol()` identity is stated here as unverified, not
   measured — but if it does, wiring it in behind a federation boundary the way ADR 0005
   describes for `vue-router` and Pinia would reproduce the same silent-failure class ADR
   0005 exists to prevent, and nothing here has checked that it does not.

Meanwhile, the translation surface this milestone actually needs — reactive `t`/`n`/`d`,
CLDR plural-category branching, and locale-aware number and date formatting — is already
available from the JavaScript runtime itself: `Intl.PluralRules` selects the correct CLDR
plural category per locale without a bundled CLDR dataset, and `Intl.NumberFormat` /
`Intl.DateTimeFormat` format numbers and dates without any library at all.

## Decision

`@sentra/i18n` implements the seam — `locale`, `t`, `n`, `d` — directly on top of `Intl`,
ships no bundled CLDR data, and provides itself behind the string injection key
`'sentra:i18n'`, the same discipline ADR 0005 requires of every `@sentra/*` plugin. `n` and
`d` are thin wrappers over `Intl.NumberFormat` and `Intl.DateTimeFormat`; plural message
branches are selected by `Intl.PluralRules`, not a hand-rolled per-locale rule.

**The exclusions, stated in full, because this decision's honesty depends on naming every
one of them:**

- **No message-extraction tooling.** Nothing in this workspace scans source for `t()`
  call sites and emits or updates a catalogue skeleton. Every catalogue key in
  `packages/*/src/i18n/*.json` and `apps/*/src/i18n/*.json` is written by hand.
- **No RTL layout support.** Nothing in `@sentra/tokens`, `@sentra/ui`, or any
  application's stylesheet accounts for a right-to-left writing direction.
- **No gender/select message syntax.** `Message`/`PluralMessage` branch only on CLDR
  plural category; there is no ICU-style `{gender, select, ...}` construct or equivalent.
- **No lazy per-route or per-locale catalogue splitting.** `mergeMessages` combines whole
  catalogues at plugin-install time; nothing loads a locale's messages incrementally.

One concrete example of what the first exclusion actually costs: `apps/shell` renders "The
platform is unavailable" when no remote is registered, but that sentence exists nowhere in
the codebase as a single translatable string. `packages/ui/src/components/RemoteUnavailable/RemoteUnavailable.vue:12`
renders the template `{{ name }} is unavailable`, and `apps/shell/src/registry/boot.ts:171`
supplies `name: 'The platform'` — the user-visible sentence is assembled at render time by
interpolating a noun phrase into a predicate across two packages. Translating it correctly
(rather than translating "is unavailable" in isolation and hoping every language's word
order happens to match English's) would require changing `RemoteUnavailable`'s props
contract to accept a fully-formed, already-localised message instead of a name to
interpolate — exactly the kind of call-site-level rework that message-extraction tooling
exists to find systematically, and that this milestone does not attempt. This is not a
defect: `RemoteUnavailable` renders correctly in English today. It is a concrete,
checkable instance of the gap the first exclusion above names in the abstract.

**The escape hatch.** An adopter who needs any of the four excluded capabilities is not
blocked by this decision. `'sentra:i18n'` is a plain string injection key exactly like
every other `@sentra/*` plugin's; `vue-i18n`, or any other implementation, can be installed
behind that same key. Every call site that only uses the four seam members (`locale`, `t`,
`n`, `d`) keeps working unmodified, because it was never coupled to `@sentra/i18n`'s
internals — only to the seam's shape.

## Consequences

**What this buys:** the platform ships translation, plural-aware formatting, and
locale-aware number/date formatting with zero additional runtime dependencies and zero
bundled CLDR data — a cost this milestone's tight, hard byte ceilings (above) could not
otherwise absorb — while leaving every excluded capability reachable behind the same
injection key an adopter would use to swap in `vue-i18n` outright.

**What this costs — the honest list:**

- No adopter gets message extraction, RTL, gender/select syntax, or lazy catalogue
  splitting from this package. Each is a real, sometimes substantial, engineering task an
  adopter who needs it must still do — either by writing it themselves or by adopting
  `vue-i18n` behind `'sentra:i18n'` and accepting its own bundle-weight and dependency-audit
  cost in exchange.
- `useI18n()`'s `NULL_I18N` fallback (returning the raw key from `t`, formatting with `en`
  from `n`/`d`) means a component that renders with no i18n installed at all fails
  silently into English-shaped output rather than erroring — the opposite of
  `@sentra/plugin-analytics`'s `useAnalytics()`, which throws when uninstalled. This is a
  deliberate choice to keep every existing `@sentra/ui` unit test and Storybook story
  working unmodified with no i18n installed, not an oversight; an adopter relying on
  `onMissing` to catch every missing key in production must actually wire it to something
  that surfaces the warning, because the default behaviour is to keep rendering.
- The Symbol-key hazard named above is explicitly unverified. An adopter who does install
  `vue-i18n` behind `'sentra:i18n'` in a federated container should verify its injection
  mechanism against ADR 0005's string-key requirement before trusting it across a
  federation boundary; this ADR does not do that verification on their behalf.

## Alternatives not taken

- **Adopt `vue-i18n`.** Rejected for this milestone on the three costs named in Context:
  a new dependency-audit surface, bundle weight against a byte ceiling with headroom
  measured in tens of bytes on the storefront's pages, and an unverified federation
  identity hazard — against a seam that `Intl.PluralRules`, `Intl.NumberFormat`, and
  `Intl.DateTimeFormat` already satisfy for what this milestone actually needs. Not
  rejected permanently: `'sentra:i18n'` exists specifically so this decision can be revisited
  per-adopter without touching call sites.
- **A hand-rolled plural-rule table per locale, instead of `Intl.PluralRules`.** Rejected:
  CLDR's plural-category rules are not simple modulo arithmetic in every locale, and
  reimplementing them invites exactly the kind of silent per-locale bug a platform-wide
  seam should not carry. `Intl.PluralRules` ships the correct rule for every locale the
  runtime supports, at zero bundle cost.
- **Bundle a CLDR dataset for number/date formatting, instead of `Intl.NumberFormat` /
  `Intl.DateTimeFormat`.** Rejected: the runtime already carries this data; bundling a
  second copy would spend bytes this milestone's ceilings cannot afford to buy something
  every target browser already provides for free.
