# Proposal claims and their evidence

**Classification: PUBLIC**

Every claim the proposal makes appears here with the check that proves it.
A claim with no evidence is not shipped. The final review runs each command
in the Evidence column and confirms it passes.

Numbering starts at C2 on purpose: C1 asserted that the platform, once the
reference implementation is deleted, "still builds, typechecks, lints, tests,
and runs — it boots in a browser with no console errors." Its evidence command
fails — `apps/shell/e2e-platform-only/platform-only.smoke.spec.ts:70` catches a
real Chrome console warning ("The Content Security Policy directive
'frame-ancestors' is ignored when delivered via a `<meta>` element") that fires
on every page load, stripped tree or not, as a consequence of CSP delivered via
a `<meta>` tag (see [ADR 0008](../adr/0008-remote-integrity-and-csp.md)). The
claim was deleted rather than reworded to a weaker, still-passing version of
itself; see [the proposal's §5](./README.md#what-the-gates-guarantee) for the
full account. The build/typecheck/lint/test portion of the original claim is
still true and still exercised by the `platform-only` CI job — it simply is
not, on its own, a claim distinct enough from ordinary build/typecheck/lint/test
to warrant its own row here.

| # | Claim | Evidence | Where | Verified |
| --- | --- | --- | --- | --- |
| C2 | Every workspace member declares which side of the boundary it is on. | `node scripts/workspace.mjs --check` | CI job `platform-only` | Pass, 2026-08-30 |
| C3 | A bundle-size regression fails the build. | `pnpm verify:bundle-size` | CI job `verify` | Pass, 2026-08-30 |
| C4 | An unreviewed high-severity advisory fails the build, and an accepted one expires. | `pnpm verify:audit` | CI job `verify` | Pass, 2026-08-30 |
| C5 | The shell ships a Content-Security-Policy generated from the same manifest it loads remotes from. | `pnpm verify:csp` and `apps/shell/e2e/csp.spec.ts` | CI jobs `verify`, `federation-e2e` | Pass, 2026-08-30 |
| C6 | A remote whose bytes do not match its published digest is not executed. | `apps/shell/src/registry/*.test.ts` and `apps/shell/e2e/integrity.spec.ts` | CI jobs `verify`, `federation-e2e` | Pass, 2026-08-30 |
| C7 | Resource budgets are enforced; lab timing metrics are reported but not enforced. | `pnpm verify:lighthouse` | CI job `lighthouse` | Pass, 2026-08-30 |
| C8 | Every app's production build ships sourcemaps. | `pnpm verify:sourcemaps` | CI job `verify` | Pass, 2026-08-30 |
| C9 | Every story passes automated accessibility checks in a real browser. | `pnpm --filter @sentra/ui test:interactions` | CI job `interactions` | Pass, 2026-08-30 |
| C10 | The federated composition works across three origins. | `pnpm --filter @sentra/shell e2e` | CI job `federation-e2e` | Pass, 2026-08-30 |
