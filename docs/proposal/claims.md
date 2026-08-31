# Proposal claims and their evidence

**Classification: PUBLIC**

Every claim the proposal makes appears here with the check that proves it.
A claim with no evidence is not shipped. The final review runs each command
in the Evidence column and confirms it passes. C1's command deletes files —
run it only in a throwaway clone, never in a working checkout.

| # | Claim | Evidence | Where | Verified |
| --- | --- | --- | --- | --- |
| C1 | The platform, once the reference implementation is deleted, still builds, typechecks, lints, tests, and runs with the three M6 battery packages present — it boots in a browser with no console errors. `@sentra/i18n`, `@sentra/plugin-errors`, and `@sentra/flags` declare `"sentra": { "role": "platform" }`, so they survive `scripts/strip-reference.mjs` (`node scripts/workspace.mjs --check` reports 10 platform, 4 reference) and their unit tests run inside this job's `test` step. `apps/shell/src/registry/boot.ts` imports `@sentra/i18n` and `@sentra/ui/i18n` at module scope, and `platform-only.smoke.spec.ts` fails on any console or page error — so an `@sentra/*` specifier the stripped build's `build.rollupOptions.external` leaves unresolved breaks that spec, the defect class the spec's header comment states it exists to catch. This is not a claim that any translated string is asserted anywhere in the platform-only job. | `node scripts/strip-reference.mjs && pnpm install --no-frozen-lockfile && VITE_SENTRA_MOCKS=true pnpm build && pnpm --filter @sentra/shell e2e:platform-only` | CI job `platform-only` | Pass, 2026-08-30 |
| C2 | Every workspace member declares which side of the boundary it is on. | `node scripts/workspace.mjs --check` | CI job `platform-only` | Pass, 2026-08-30 |
| C3 | A bundle-size regression fails the build. | `pnpm verify:bundle-size` | CI job `verify` | Pass, 2026-08-30 |
| C4 | An unreviewed high-severity advisory fails the build, and an accepted one expires. | `pnpm verify:audit` | CI job `verify` | Pass, 2026-08-30 |
| C5 | The shell ships a Content-Security-Policy generated from the same manifest it loads remotes from. | `pnpm verify:csp` and `apps/shell/e2e/csp.spec.ts` | CI jobs `verify`, `federation-e2e` | Pass, 2026-08-30 |
| C6 | A remote whose bytes do not match its published digest is not executed. | `apps/shell/src/registry/*.test.ts` and `apps/shell/e2e/integrity.spec.ts` | CI jobs `verify`, `federation-e2e` | Pass, 2026-08-30 |
| C7 | Resource budgets are enforced; lab timing metrics are reported but not enforced. | `pnpm verify:lighthouse` | CI job `lighthouse` | Pass, 2026-08-30 |
| C8 | Every app's production build ships sourcemaps. | `pnpm verify:sourcemaps` | CI job `verify` | Pass, 2026-08-30 |
| C9 | Every story passes automated accessibility checks in a real browser. | `pnpm --filter @sentra/ui test:interactions` | CI job `interactions` | Pass, 2026-08-30 |
| C10 | The federated composition works across three origins. | `pnpm --filter @sentra/shell e2e` | CI job `federation-e2e` | Pass, 2026-08-30 |
| C11 | A translation catalogue missing a key, missing a plural `other` branch, or dropping a `{placeholder}` present in the reference locale fails the build. | `pnpm verify:catalogues` (`scripts/check-catalogues.mjs`) — proven to actually fail, not merely pass, by Task 5 Step 6's deliberate fixture: dropping `{column}` from `packages/ui/src/i18n/id.json`'s `ui.dataTable.sortBy` produced `Catalogue check failed (1): packages/ui: id.json "ui.dataTable.sortBy" drops placeholder {column}` (exit 1), and reverting the fixture restored a clean pass. | CI job `verify`, step `Check translation catalogues` | Pass, 2026-08-31 |
