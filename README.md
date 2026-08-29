# Sentra

[![CI](https://github.com/barayuda/sentra/actions/workflows/ci.yml/badge.svg)](https://github.com/barayuda/sentra/actions/workflows/ci.yml)

Sentra is a front-end platform monorepo: a design-token pipeline, an accessible Vue 3
component library, and the shared tooling that keeps every workspace on one set of rules.
It is built so that multiple teams can ship into one storefront without colliding — shared
foundations here, independent deploy cadence at the edges.

## What's inside

| Package                    | What it does                                                                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sentra/tokens`           | Design tokens as a typed TypeScript source of truth. A build step **generates** the CSS — a Tailwind 4 `@theme` block plus `:root` custom properties, dark and compact-density override blocks — so one edit propagates to every consumer.                                                                  |
| `@sentra/ui`               | Vue 3 component library — ten components (`Button`, `Input`, `Select`, `Checkbox`, `Combobox`, `Dialog`, `DataTable`, `Toast`, `Money`, `ProductCard`) with an enforced accessibility baseline, documented in Storybook where a11y violations fail the build.                                               |
| `@sentra/plugin-analytics` | Schema-validated, allowlist-only analytics as a Vue plugin — a field not named in the schema never leaves the page. Behavioural events and Web Vitals share one pipeline.                                                                                                                                   |
| `@sentra/sdk-commerce`     | Typed Shopify Storefront client. Types **generated** from a vendored copy of the published GraphQL schema; failures return a four-member typed taxonomy (`NetworkError`, `GraphQLUserError`, `ThrottledError`, `SchemaError`) rather than thrown strings. Mock-first via MSW, so the demo needs no network. |
| `@sentra/sdk-ops`          | Typed client for the console's ops backend — orders and feature flags. Same `Result`/error-taxonomy convention as `@sentra/sdk-commerce`, over a REST transport rather than GraphQL.                                                                                                                        |
| `@sentra/result`           | The `Result<T, E>` discriminated union both SDKs and `@sentra/shell-contract` build on. Zero runtime dependencies.                                                                                                                                                                                          |
| `@sentra/shell-contract`   | The typed contract between `apps/shell` and every remote it composes: `RemoteModule`, the `ShellBus` event map, and the manifest schema the shell validates `remotes.json` against.                                                                                                                         |
| `@sentra/config`           | Shared tool configuration: the strict `tsconfig` base every package extends and a Vitest config factory.                                                                                                                                                                                                    |

Each package has its own README covering what it does, how to use it, and what it depends
on. Architecture decisions live in [`docs/adr/`](docs/adr/): [ADR 0001](docs/adr/0001-federation-plugin-choice.md)
records the runtime micro-frontend evaluation (Module Federation on Vite) that shapes the
application layer, [ADR 0002](docs/adr/0002-vitest-and-jest.md) records the Vitest/Jest
dual-runner decision, with the `tokens` suite as the running evidence,
[ADR 0003](docs/adr/0003-vendored-schema-and-mock-first-commerce.md) records why
`@sentra/sdk-commerce` vendors its schema and runs mock-first rather than against a live
store, [ADR 0004](docs/adr/0004-runtime-remote-registry.md) records how the shell
registers remotes at runtime rather than at build time, [ADR 0005](docs/adr/0005-federation-shared-singletons.md)
records what is shared as a singleton across the federation boundary and why the
workspace's own packages deliberately are not, and [ADR 0006](docs/adr/0006-cross-remote-communication.md)
records how the shell and a remote exchange information without one importing the other.

## Applications

Three containers, one federation boundary. The shell is the only one a browser loads
directly; the other two are also loadable standalone, for their own dev loop and their
own end-to-end suite.

| App               | Role   | Dev port | Preview port | Mounted at |
| ----------------- | ------ | -------- | ------------ | ---------- |
| `apps/shell`      | Host   | 5175     | 4175         | `/`        |
| `apps/storefront` | Remote | 5173     | 4173         | `/shop`    |
| `apps/console`    | Remote | 5174     | 4174         | `/ops`     |

A remote, in this platform, is not a mounted sub-application with its own router and its
own `App` instance — it is routes, plus an optional overlay, plus a registration hook
(`RemoteModule`, from `@sentra/shell-contract`), because two independent routers cannot
share one browser `history` object, so the shell is the one place a router lives.

| App               | What it does                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/shell`      | The host: chrome (header, toast host), the only router and browser history, and a runtime remote registry — see [its README](apps/shell/README.md) for the boot sequence, `remotes.json`, and the `?break=<name>` failure demonstration.                                                                                                                             |
| `apps/storefront` | A Vue 3 storefront built on `@sentra/sdk-commerce` and `@sentra/ui`: a virtualised product listing, a product detail page, and a cart drawer that hands off checkout to Shopify's hosted, PCI-compliant page. Runs entirely against MSW fixtures by default — see [its README](apps/storefront/README.md) for the demo controls that trigger every error state live. |
| `apps/console`    | An ops console on `@sentra/sdk-ops`: an orders table and feature-flag toggles, gated behind a `requiresRole: 'ops'` route guard — see [its README](apps/console/README.md).                                                                                                                                                                                          |

```bash
cp apps/storefront/.env.example apps/storefront/.env.local
pnpm --filter @sentra/storefront dev
```

### Run the whole platform

Both remotes must be built and served from their preview ports before the shell can load
them; the shell itself also needs its mocks flag set so `?break=<name>` and the mock
Service Worker are live. Each preview server is bound to `127.0.0.1` explicitly rather
than the `localhost` default — see `apps/shell/README.md`'s Troubleshooting section for
why that matters on a dual-stack loopback.

```bash
VITE_SENTRA_MOCKS=true pnpm --filter @sentra/storefront build && \
  pnpm --filter @sentra/storefront preview --port 4173 --strictPort --host 127.0.0.1 &

VITE_SENTRA_MOCKS=true pnpm --filter @sentra/console build && \
  pnpm --filter @sentra/console preview --port 4174 --strictPort --host 127.0.0.1 &

VITE_SENTRA_MOCKS=true pnpm --filter @sentra/shell build && \
  pnpm --filter @sentra/shell preview --port 4175 --strictPort --host 127.0.0.1 &
```

Open `http://127.0.0.1:4175`.

## Getting started

Prerequisites: Node `>= 24.15.0` (see `.nvmrc`) and pnpm `>= 10.34.5`.

```bash
pnpm install
pnpm build        # generates tokens CSS, then builds the ui library
pnpm test         # 353 tests across all packages; the tokens suite also passes under Jest (ADR 0002)
pnpm --filter @sentra/ui storybook   # component workbench on :6006
```

## Scripts

| Command                                | What it runs                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm build`                           | Turborepo build graph (`tokens` before `ui`, by dependency)                     |
| `pnpm test`                            | Vitest suites in every package                                                  |
| `pnpm typecheck`                       | `tsc --noEmit` / `vue-tsc --noEmit` per package                                 |
| `pnpm lint`                            | ESLint flat config — `vue/no-v-html` is enforced as a security control          |
| `pnpm format:check`                    | Prettier verification (CI-blocking)                                             |
| `pnpm --filter @sentra/storefront e2e` | Playwright smoke suite against the production storefront build                  |
| `pnpm --filter @sentra/shell e2e`      | Federated Playwright suite — builds and serves all three apps, drives the shell |

CI now runs four jobs on every push and pull request — `verify` (format, lint, build,
typecheck, test, the `tokens` Jest suite, and the Storybook build), `interactions`
(Storybook's play functions and a11y checks in a real browser), `e2e` (the Playwright
suite against the built storefront alone), and `federation-e2e` (the Playwright suite
against all three built apps together, proving the federation boundary itself) — with the
Storybook static build and, on failure, the relevant Playwright report, uploaded as
artifacts.

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
  buys.
- **Security controls are boundaries, not conventions.** There is exactly one `v-html` in
  the repository (`apps/storefront/src/components/RichText.vue`), behind a branded type
  (`UnsafeHtml`/`SafeHtml`) and an allowlist sanitiser, with `vue/no-v-html` enforced as a
  lint error everywhere else — so a second one cannot be added without a reviewer seeing a
  deliberate suppression.

## Roadmap

Runtime micro-frontend shell wiring (ADR 0001) and `apps/console` (an internal ops
remote, deliberately a different application shape from the storefront) both shipped in
M4 — see ADRs 0004–0006 and the applications table above. What ADR 0001 flagged as still
open, and M4 did not address:

- Runtime-loaded federated code as a security surface — CSP `script-src` should
  enumerate remote origins explicitly, and subresource integrity does not apply cleanly
  to a federated entry fetched at runtime rather than pinned at build time.

## License

[MIT](LICENSE) © 2026 Bara Yuda
