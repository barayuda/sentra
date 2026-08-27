# ADR 0002 — Vitest as primary runner, Jest as demonstrated alternative

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-28
- **Decides:** which test runner the monorepo standardises on, and why one
  package additionally runs under Jest.

## Context

Vitest is this repository's primary runner: it shares Vite's transform
pipeline (the same config that builds `@sentra/ui` runs its tests), supports
ESM and explicit `.ts` extensions natively, and its API is
Jest-compatible by design. The `@sentra/tokens` suite additionally runs
under Jest 30 — the same test files, dual-hosted via a module shim — to keep
the comparison evidenced rather than rhetorical.

## What the dual hosting required

| Concern | Vitest | Jest |
|---|---|---|
| TypeScript transform | Vite (esbuild), zero config | `@swc/jest` (chosen over ts-jest to avoid a `typescript` peer under TS7) |
| ESM + explicit `.ts` extensions | native | CJS transform + `moduleNameMapper` extension strip |
| API imports | `vitest` module | `@jest/globals` behind a shim, plus two polyfills the suite actually needed (see below) |
| Config | shared factory in `@sentra/config` | per-package `jest.config.mjs` |

"Jest-compatible by design" turned out to mean *intersection*, not
*identity*. Running the suite unmodified under Jest surfaced two Vitest-only
`expect` features the tokens tests actually use:

- `expect(actual, customMessage)` — Vitest accepts an optional second
  argument overriding the failure message; Jest's `expect` throws
  `"Expect takes at most one argument"` if called with more than one.
  `darkTokens › overrides only existing token paths` uses this form.
- `toBeTypeOf` — a Vitest built-in matcher with no Jest equivalent.
  `tokens › defines a brand colour scale` uses it.

Both failed on the first Jest run with the test files unmodified, exactly as
predicted — the fix lives entirely in
`packages/tokens/test/vitest-shim.ts`: the exported `expect` wraps
`@jest/globals`'s `expect` to drop the extra argument (identical pass/fail
outcome; only Jest's own failure-message text differs from what Vitest would
print), and `toBeTypeOf` is added via `expect.extend`. The test files were
never touched.

## Measurements (tokens suite, 25 tests, Darwin arm64 / Node v24.15.0, 2026-08-28)

- Vitest: 0.54 s (`Duration` as reported by Vitest; two consecutive runs: 0.535 s, 0.541 s)
- Jest: 0.15 s (`Time` as reported by Jest; two consecutive runs: 0.155 s, 0.149 s)

Both figures are the runner's own self-reported test-execution time, not the
wrapping `pnpm --filter` process time (which includes pnpm/Node startup and
runs 1–2 s regardless of runner). Jest's in-process number is the smaller of
the two here, but at this suite size (25 trivial unit tests) the difference
is process-startup noise, not a meaningful throughput signal in either
direction — nothing about this measurement generalises to larger suites.

## Decision

Vitest remains primary everywhere. Jest stays wired on `tokens` only, in CI,
as living proof the suites are runner-portable and the team is fluent in
both. New packages get Vitest.

## Consequences

- The shim constrains `tokens` tests to the API intersection (`describe` /
  `it` / `expect`); a test needing `vi.*` would need the shim extended with
  Jest equivalents. In practice the intersection needed two additions
  already (a dropped `expect` argument, a polyfilled `toBeTypeOf` matcher) —
  extending this shim to a second package's suite is not guaranteed to be a
  copy-paste operation without first checking that suite's own `expect`
  usage against Jest's built-in matcher set.
- Two runners in one lockfile is real dependency surface in principle, but
  measured zero here: `pnpm install` after adding `jest`, `@swc/jest`,
  `@swc/core`, and `@jest/globals` to `packages/tokens/package.json`
  produced a 12-line `pnpm-lock.yaml` diff, entirely inside the `tokens`
  importer's `devDependencies` block (new specifiers, no new `version:`
  values). Diffing the lockfile's `packages:` and `snapshots:` catalog
  sections confirms 0 net-new package entries — every resolved version
  these four packages need was already present, because
  `@storybook/test-runner` (used by the `interactions` CI job via
  `@sentra/ui`) is itself Jest-built and already pulled the same Jest 30 /
  `@swc/core` 1.16.1 dependency tree in transitively. The dependency surface
  this ADR warned about is real in the sense that four packages are now
  direct `devDependencies` of one package, but it added no new code to the
  lockfile that wasn't already being installed for an unrelated reason.
