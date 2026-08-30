# Sentra

[![CI](https://github.com/barayuda/sentra/actions/workflows/ci.yml/badge.svg)](https://github.com/barayuda/sentra/actions/workflows/ci.yml)

Sentra is a template: a base platform for building a federated Vue 3 front end, plus a
working reference implementation (a storefront and an internal ops console) that proves
the platform works and that you are meant to delete. Clone it, delete the reference
implementation, keep the platform. The full case for this shape — and the evidence behind
every claim below — is [`docs/proposal/README.md`](docs/proposal/README.md).

## What's included, and what isn't

Sentra ships a design-token pipeline, an accessibility-gated component library, a
federation host with a runtime remote registry, a generated Content-Security-Policy, a
remote-integrity check, and the CI gates that enforce them. It does not ship, and does not attempt to ship,
a full application platform:

| You get                                                                 | You still need                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| Design tokens → generated CSS (`@sentra/tokens`)                        | Authentication / identity provider integration |
| Accessibility-gated Vue 3 components (`@sentra/ui`)                     | Internationalisation                           |
| Schema-validated, allowlist-only analytics (`@sentra/plugin-analytics`) | Server-side rendering or static generation     |
| Federation host + runtime remote registry (`apps/shell`)                | An error-tracking or APM vendor                |
| Typed shell/remote contract (`@sentra/shell-contract`)                  | A design system beyond primitives and tokens   |
| Generated CSP, remote-integrity verification                            | An API gateway or a BFF                        |
| Shared tool config (`@sentra/config`)                                   | A CMS integration                              |
| Bundle-size, audit, Lighthouse, CSP, and integrity CI gates             | Deployment and hosting configuration           |
|                                                                         | A feature-flag backend                         |

See [the proposal's "batteries included, and not"](docs/proposal/README.md#batteries-included-and-not)
for why this line is drawn where it is.

## Platform and reference implementation

Every workspace member declares which side of the boundary it is on (`sentra.role` in its
own `package.json`), and the declaration is checked (`pnpm verify:roles`), not merely
documented:

| Role                           | Members                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Platform** — kept            | `@sentra/shell`, `@sentra/ui`, `@sentra/tokens`, `@sentra/result`, `@sentra/config`, `@sentra/shell-contract`, `@sentra/plugin-analytics` |
| **Reference** — safe to delete | `@sentra/storefront`, `@sentra/console`, `@sentra/sdk-commerce`, `@sentra/sdk-ops`                                                        |

Each package's own README states its role in the same words as this table. To adopt the
platform without the demo:

```bash
node scripts/strip-reference.mjs
pnpm install --no-frozen-lockfile
```

This is not a suggestion checked only by convention: `.github/workflows/ci.yml`'s
`platform-only` job runs this exact deletion in a throwaway clone, then rebuilds,
typechecks, lints, and tests what remains, on every push. See
[the proposal's "adopting it"](docs/proposal/README.md#adopting-it) for what to change
first afterward, and [claims.md](docs/proposal/claims.md) for exactly what that CI job
currently does and does not prove.

## Getting started

Prerequisites: Node `>= 24.15.0` (see `.nvmrc`) and pnpm `>= 10.34.5`.

```bash
pnpm install
pnpm build        # generates tokens CSS, then builds the ui library
pnpm test         # Vitest across every workspace member; run it to see the current count
pnpm --filter @sentra/ui storybook   # component workbench on :6006
```

To run the reference storefront on its own:

```bash
cp apps/storefront/.env.example apps/storefront/.env.local
pnpm --filter @sentra/storefront dev
```

## Applications

Separate containers, one federation boundary. The shell is the only one a browser loads
directly; the other two are also loadable standalone, for their own dev loop and their own
end-to-end suite.

| App               | Role   | Platform side | Dev port | Preview port | Mounted at |
| ----------------- | ------ | ------------- | -------- | ------------ | ---------- |
| `apps/shell`      | Host   | platform      | 5175     | 4175         | `/`        |
| `apps/storefront` | Remote | reference     | 5173     | 4173         | `/shop`    |
| `apps/console`    | Remote | reference     | 5174     | 4174         | `/ops`     |

A remote, in this platform, is not a mounted sub-application with its own router and its
own `App` instance — it is routes, plus an optional overlay, plus a registration hook
(`RemoteModule`, from `@sentra/shell-contract`), because two independent routers cannot
share one browser `history` object, so the shell is the one place a router lives.

| App               | What it does                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/shell`      | The host: chrome (header, toast host), the only router and browser history, a runtime remote registry, and a generated CSP — see [its README](apps/shell/README.md) for the boot sequence, `remotes.json`, and the `?break=<name>` failure demonstration.                                                                                                                                                      |
| `apps/storefront` | A Vue 3 storefront built on `@sentra/sdk-commerce` and `@sentra/ui`: a virtualised product listing, a product detail page, and a cart drawer that hands off checkout to Shopify's hosted, PCI-compliant page. Runs entirely against MSW fixtures by default — see [its README](apps/storefront/README.md) for the demo controls that trigger every error state live. Reference implementation: safe to delete. |
| `apps/console`    | An ops console on `@sentra/sdk-ops`: an orders table and feature-flag toggles, gated behind a `requiresRole: 'ops'` route guard — see [its README](apps/console/README.md). Reference implementation: safe to delete.                                                                                                                                                                                          |

### Run the whole platform

Both remotes must be built and served from their preview ports before the shell can load
them; the shell itself also needs its mocks flag set so `?break=<name>` and the mock
Service Worker are live. Each preview server is bound to `127.0.0.1` explicitly rather than
the `localhost` default — see `apps/shell/README.md`'s Troubleshooting section for why that
matters on a dual-stack loopback.

```bash
VITE_SENTRA_MOCKS=true pnpm --filter @sentra/storefront build && \
  pnpm --filter @sentra/storefront preview --port 4173 --strictPort --host 127.0.0.1 &

VITE_SENTRA_MOCKS=true pnpm --filter @sentra/console build && \
  pnpm --filter @sentra/console preview --port 4174 --strictPort --host 127.0.0.1 &

VITE_SENTRA_MOCKS=true pnpm --filter @sentra/shell build && \
  pnpm --filter @sentra/shell preview --port 4175 --strictPort --host 127.0.0.1 &
```

Open `http://127.0.0.1:4175`.

## Workspace members

Each package has its own README covering what it does, how to use it, what it depends on,
and its platform/reference role.

| Package                    | What it does                                                                                                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sentra/tokens`           | Design tokens as a typed TypeScript source of truth. A build step **generates** the CSS — a Tailwind 4 `@theme` block plus `:root` custom properties, dark and compact-density override blocks — so one edit propagates to every consumer.                                                                                                |
| `@sentra/ui`               | Vue 3 component library — `Button`, `Input`, `Select`, `Checkbox`, `Combobox`, `Dialog`, `DataTable`, `Toast`, `Money`, `ProductCard` — with an enforced accessibility baseline, documented in Storybook where a11y violations fail the build.                                                                                            |
| `@sentra/plugin-analytics` | Schema-validated, allowlist-only analytics as a Vue plugin — a field not named in the schema never leaves the page. Behavioural events and Web Vitals share one pipeline.                                                                                                                                                                 |
| `@sentra/shell-contract`   | The typed contract between `apps/shell` and every remote it composes: `RemoteModule`, the `ShellBus` event map, and the manifest schema the shell validates `remotes.json` against.                                                                                                                                                       |
| `@sentra/result`           | The `Result<T, E>` discriminated union both SDKs and `@sentra/shell-contract` build on. Zero runtime dependencies.                                                                                                                                                                                                                        |
| `@sentra/config`           | Shared tool configuration: the strict `tsconfig` base every package extends and a Vitest config factory.                                                                                                                                                                                                                                  |
| `@sentra/sdk-commerce`     | Typed Shopify Storefront client. Types **generated** from a vendored copy of the published GraphQL schema; failures return a typed taxonomy (`NetworkError`, `GraphQLUserError`, `ThrottledError`, `SchemaError`) rather than thrown strings. Mock-first via MSW, so the demo needs no network. Reference implementation: safe to delete. |
| `@sentra/sdk-ops`          | Typed client for the console's ops backend — orders and feature flags. Same `Result`/error-taxonomy convention as `@sentra/sdk-commerce`, over a REST transport rather than GraphQL. Reference implementation: safe to delete.                                                                                                            |

Architecture decisions live in [`docs/adr/`](docs/adr/): [ADR 0001](docs/adr/0001-federation-plugin-choice.md)
records the runtime micro-frontend evaluation (Module Federation on Vite), [ADR 0002](docs/adr/0002-vitest-and-jest.md)
records the Vitest/Jest dual-runner decision, [ADR 0003](docs/adr/0003-vendored-schema-and-mock-first-commerce.md)
records why `@sentra/sdk-commerce` vendors its schema and runs mock-first (reference-owned;
removed along with the reference implementation), [ADR 0004](docs/adr/0004-runtime-remote-registry.md)
records how the shell registers remotes at runtime rather than at build time, [ADR 0005](docs/adr/0005-federation-shared-singletons.md)
records what is shared as a singleton across the federation boundary and why the
workspace's own packages deliberately are not, [ADR 0006](docs/adr/0006-cross-remote-communication.md)
records how the shell and a remote exchange information without one importing the other,
[ADR 0007](docs/adr/0007-platform-and-reference-boundary.md) records the platform/reference
split itself, [ADR 0008](docs/adr/0008-remote-integrity-and-csp.md) records the CSP and
remote-integrity design (and its stated limitations), [ADR 0009](docs/adr/0009-gate-policy.md)
records how every CI gate's pass/fail boundary was chosen, and [ADR 0010](docs/adr/0010-motion-and-reduced-motion.md)
records why transition timing is a token and `prefers-reduced-motion` is a mode override
rather than component logic.

## Scripts

| Command                                         | What it runs                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm build`                                    | Turborepo build graph (`tokens` before `ui`, by dependency)                      |
| `pnpm test`                                     | Vitest suites in every package                                                   |
| `pnpm typecheck`                                | `tsc --noEmit` / `vue-tsc --noEmit` per package                                  |
| `pnpm lint`                                     | ESLint flat config — `vue/no-v-html` is enforced as a security control           |
| `pnpm format:check`                             | Prettier verification (CI-blocking)                                              |
| `pnpm verify:roles`                             | Confirms every workspace member declares a valid `sentra.role`                   |
| `pnpm verify:csp`                               | Regenerates the shell's CSP from `remotes.json` and `security/csp-sources.json`  |
| `pnpm verify:bundle-size`                       | Fails the build on a bundle-size regression                                      |
| `pnpm verify:audit`                             | Dependency audit against `security/audit-allowlist.json`                         |
| `pnpm verify:lighthouse`                        | Lighthouse budgets (resource size, accessibility hard; timing metrics warn-only) |
| `pnpm --filter @sentra/storefront e2e`          | Playwright smoke suite against the production storefront build                   |
| `pnpm --filter @sentra/shell e2e`               | Federated Playwright suite — builds and serves every app, drives the shell       |
| `pnpm --filter @sentra/shell e2e:platform-only` | Playwright smoke suite against the stripped, platform-only build                 |

CI runs these jobs on every push and pull request: `verify` (format, lint, build, typecheck,
test, the `tokens` Jest suite, and the Storybook build), `interactions` (Storybook's play
functions and a11y checks in a real browser), `e2e` (the Playwright suite against the built
storefront alone), `federation-e2e` (the Playwright suite against every built app
together, proving the federation boundary itself), `lighthouse` (resource, accessibility,
and timing budgets against the full build), and `platform-only` (deletes the reference
implementation in a throwaway clone, then rebuilds, typechecks, lints, tests, and smoke-runs
what remains) — with the Storybook static build and, on failure, the relevant Playwright
report, uploaded as artifacts.

## Design principles

- **Generated, never hand-maintained.** Tokens are data; the CSS is build output. The
  `@theme` block means Tailwind utilities and raw custom properties come from one source.
- **Accessibility is a gate, not a claim.** Labels are programmatically associated, errors
  reach assistive technology via `aria-describedby` in reading order, and Storybook's a11y
  addon fails on violations.
- **Consumer styles win predictably.** All component styling lives inside CSS cascade
  layers, so an ordinary unlayered rule in an application overrides any Sentra component
  without specificity escalation — the layer strategy is documented in
  [`packages/ui`](packages/ui/README.md).
- **Decisions carry their costs.** ADRs record what each choice costs, not just what it
  buys, and a superseded decision gets a new ADR rather than a silent edit to the old one.
- **Security controls are boundaries, not conventions.** `vue/no-v-html` is a lint error
  everywhere in this workspace; the one place that needs raw HTML
  (`apps/storefront/src/components/RichText.vue`, reference-owned and removed with the rest
  of the reference implementation) goes through a branded type (`UnsafeHtml`/`SafeHtml`) and
  an allowlist sanitiser rather than a suppressed lint rule, so a second unreviewed `v-html`
  cannot be added without a reviewer seeing a deliberate exception.
- **A guarantee is a command, not a sentence.** Every claim this platform makes about
  itself — what a CI gate proves and what it does not — has a row in
  [`docs/proposal/claims.md`](docs/proposal/claims.md) naming the exact command that checks
  it.

## License

[MIT](LICENSE) © 2026 Bara Yuda
