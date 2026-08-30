# Proposal claims and their evidence

**Classification: PUBLIC**

Every claim the proposal makes appears here with the check that proves it.
A claim with no evidence is not shipped. The final review runs each command
in the Evidence column and confirms it passes.

| # | Claim | Evidence | Where |
| --- | --- | --- | --- |
| C1 | The reference implementation can be deleted and the platform still builds, typechecks, lints and tests. | `node scripts/strip-reference.mjs && pnpm install --no-frozen-lockfile && pnpm build && pnpm typecheck && pnpm lint && pnpm test` | CI job `platform-only` |
| C2 | Every workspace member declares which side of the boundary it is on. | `node scripts/workspace.mjs --check` | CI job `platform-only` |
| C3 | A bundle-size regression fails the build. | `pnpm verify:bundle-size` | CI job `verify` |
| C4 | An unreviewed high-severity advisory fails the build, and an accepted one expires. | `pnpm verify:audit` | CI job `verify` |
| C5 | The shell ships a Content-Security-Policy generated from the same manifest it loads remotes from. | `pnpm verify:csp` and `apps/shell/e2e/csp.spec.ts` | CI jobs `verify`, `federation-e2e` |
| C6 | A remote whose bytes do not match its published digest is not executed. | `apps/shell/src/registry/*.test.ts` and `apps/shell/e2e/integrity.spec.ts` | CI jobs `verify`, `federation-e2e` |
| C7 | Resource budgets are enforced; lab timing metrics are reported but not enforced. | `pnpm verify:lighthouse` | CI job `lighthouse` |
| C8 | Every app's production build ships sourcemaps. | `pnpm verify:sourcemaps` | CI job `verify` |
| C9 | Every story passes automated accessibility checks in a real browser. | `pnpm --filter @sentra/ui test:interactions` | CI job `interactions` |
| C10 | The federated composition works across three origins. | `pnpm --filter @sentra/shell e2e` | CI job `federation-e2e` |
