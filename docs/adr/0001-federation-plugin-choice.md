# ADR 0001 — Micro-frontend integration approach

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-27
- **Decides:** how `apps/shell` composes `apps/storefront` and `apps/console` in M4.

## Context

Spec §3 states the premise: multiple independently-owned teams ship into one storefront
without colliding. That premise, not bundle size, is what motivates runtime composition —
the requirement is independent _deploy cadence_.

Candidates considered, with registry evidence gathered 2026-08-27:

| Candidate                          | Version | Last published | Declared Vite support        |
| ----------------------------------- | ------- | --------------- | ----------------------------- |
| `@module-federation/vite`          | 1.20.9  | 2026-08-26      | `^5 \|\| ^6 \|\| ^7 \|\| ^8`  |
| `@originjs/vite-plugin-federation` | 1.4.1   | 2026-01-04      | none declared                 |
| `@module-federation/enhanced`      | 2.9.0   | 2026-08-24      | webpack only                  |
| Web components                     | n/a     | n/a              | build-time, no plugin needed  |
| Build-time monorepo composition    | n/a     | n/a              | no independent deploy         |

Only `@module-federation/vite` was spiked. `@originjs` declares no peer dependencies, so
npm cannot warn on incompatibility; `@module-federation/enhanced` targets webpack;
build-time composition was excluded because it cannot satisfy independent deploy cadence.

## Spike results

| #   | Question                           | Result | Notes                                                                                                                                                                                     |
| --- | ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Host and remote both build          | Pass   | `vite build` exited 0 for both `spike-remote` and `spike-host` against Vue 3.5.42 / Vite 8.2.2 / `@module-federation/vite` 1.20.9. Both runs logged a non-fatal `[ Module Federation DTS ]` error (`TS5058: ... tsconfig.json does not exist`) because neither spike app has a `tsconfig.json`; the plugin's default cross-federation type-generation step fails but does not fail the build. |
| Q2  | Remote component renders in host    | Pass   | Navigated to `http://localhost:5000` with Playwright; accessibility snapshot showed the paragraph "Rendered by the REMOTE." inside the host page.                                        |
| Q3  | Vue shared as a singleton           | Pass   | Same snapshot showed "Injected from host: hello from the host" — the remote's `inject('host-message')` resolved the host's `provide()` value, which is only possible if both share one Vue instance. |
| Q4  | Host survives unreachable remote    | Pass   | Killed the remote's preview server (port 5001), hard-reloaded `http://localhost:5000`. Console showed `net::ERR_CONNECTION_REFUSED` and a caught `[ Federation Runtime ] RUNTIME-008` error; the page itself still rendered "HOST shell" and "Remote unavailable — shell still alive." via the scaffolded `defineAsyncComponent({ onError })` handler. No blank page. |
| Q5  | Source maps usable across boundary  | Fail (default config); fixable | With the scaffold's default `vite.config.ts` (no `build.sourcemap`), a `throw new Error('probe')` added to `RemoteCard.vue`'s setup produced a browser stack trace naming only the bundled chunk — `at setup (http://localhost:5001/assets/RemoteCard-DAIcXbWu.js:1:221)` — never `RemoteCard.vue`. Follow-up: adding `build.sourcemap: true` to the remote's config produced a correctly linked `.map` file whose `sources` field names `../../src/RemoteCard.vue`, served with HTTP 200 from the remote's own origin with no CORS failure — so Chrome DevTools' Sources panel would resolve it. This is not the default, though, and the raw `Error.stack` string that gets sent to log aggregators (e.g. Sentry) always names the compiled chunk regardless of sourcemaps — sourcemap resolution is a devtools/tooling-side lookup, not a change to the stack string itself. |

Actual plugin API observed: identical to the brief's planned guess. `import { federation } from '@module-federation/vite'` resolves; `federation(options: ModuleFederationOptions): any[]` accepts `name`, `filename`, `exposes`, `shared: { vue: { singleton: true } }` on the remote and `name`, `remotes`, `shared` on the host, exactly as scaffolded — no changes were needed to either `vite.config.ts`. The one discrepancy is cosmetic: the brief's instruction to inspect `node_modules/@module-federation/vite/dist/*.d.ts` names the wrong directory — the package's compiled output and type declarations live under `lib/`, not `dist/` (`lib/index.d.ts`, `lib/index.js`), per its own `package.json` `exports` map (`"." : { "types": "./lib/index.d.ts", "default": "./lib/index.js" }`).

Two additional operational findings, neither of which changes the Q1–Q5 verdicts:

- Running `pnpm install` from `spike/federation/remote` (or `host`) exactly as the brief's Step 4 shows silently does nothing for that package: pnpm walks up to the repo's `pnpm-workspace.yaml`, treats the invocation as workspace-scoped, and — because `spike/*` isn't a listed workspace glob — installs the monorepo's four real workspace packages instead of `spike-remote`, leaving no `node_modules` in the spike directory. `pnpm install --ignore-workspace` was required to get an isolated install for each spike app. This is an artifact of the spike deliberately living outside `packages/*`/`apps/*`; M4's real `apps/shell`, `apps/storefront`, and `apps/console` will live inside those globs and won't hit this.
- The plugin's default cross-federation TypeScript type generation (`dts` option, on by default) shells out to `tsc --showConfig` and fails loudly (but non-fatally) without a `tsconfig.json` per app. M4 apps will have their own `tsconfig.json` already, so this is expected to resolve itself, but it's worth a deliberate check rather than assuming it works.

## Decision

We will use `@module-federation/vite` for M4.

All five questions returned usable answers with no build failures and no silent
correctness gap: Q1–Q4 passed outright, and Q3 — the load-bearing question — passed
cleanly, meaning Vue genuinely runs as one shared instance across the federation boundary
rather than silently duplicating (the D4 failure mode). Q5 failed under the scaffold's
default config but the underlying cause (source maps not generated by default) is a
one-line, well-understood fix, not a structural limitation of the plugin or the
federation approach.

## Consequences

**What this buys:** independent deploy cadence per remote; a remote ships without a shell
rebuild.

**What this costs — the honest list:**

- Shared-dependency version skew. Vue must stay a pinned singleton across host and every
  remote. Q3 passed with both spike apps pinned to the identical `vue@3.5.42`; this spike
  did not test what happens on a version mismatch (e.g. host on 3.5.x, remote on 3.4.x),
  so M4 must still enforce the pin — e.g. via `packages/config` or a shared catalog entry —
  rather than relying on `singleton: true` alone to catch drift at build time.
- Debugging across the boundary. Q5 failed under default config: without an explicit
  `build.sourcemap: true` in every remote's `vite.config.ts`, stack traces across the
  federation boundary name only a minified chunk, not the original `.vue` file. This is
  fixable — verified — but it is an opt-in every remote's Vite config must carry, and it
  does not by itself fix log-aggregator readability (Sentry-style tools need their own
  sourcemap upload/resolution step regardless, same as any minified bundle).
- Deploy coordination: the shell's remote manifest must not reference a URL that has not
  been deployed yet.
- Runtime-loaded third-party code becomes a security surface. M5 must address this under
  transport security (spec §10): CSP `script-src` must enumerate remote origins, and
  subresource integrity does not apply cleanly to federated entries.

**What M4 must now design explicitly:** nothing beyond the plan. Q4 passed with the
scaffolded `defineAsyncComponent({ onError })` pattern alone — no custom error-boundary
component was needed for the host shell to survive a dead remote. M4 should still adopt
this same pattern (or a shared wrapper around it) consistently for every remote mount
point, and should additionally require `build.sourcemap: true` on every remote's Vite
config as a lint/CI-checkable convention, given the Q5 finding above.

## Alternatives not taken

- **Web components:** framework-agnostic and no plugin dependency, but loses Vue's
  reactivity across the boundary and complicates prop passing beyond strings.
- **iframes:** strongest isolation, unacceptable for a shared storefront layout.
- **Build-time monorepo composition:** simplest and fastest, but every remote change
  requires a shell rebuild and redeploy — which defeats the §3 premise entirely.
