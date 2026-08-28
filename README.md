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
| `@sentra/config`           | Shared tool configuration: the strict `tsconfig` base every package extends and a Vitest config factory.                                                                                                                                                                                                    |

Each package has its own README covering what it does, how to use it, and what it depends
on. Architecture decisions live in [`docs/adr/`](docs/adr/): [ADR 0001](docs/adr/0001-federation-plugin-choice.md)
records the runtime micro-frontend evaluation (Module Federation on Vite) that shapes the
application layer, [ADR 0002](docs/adr/0002-vitest-and-jest.md) records the Vitest/Jest
dual-runner decision, with the `tokens` suite as the running evidence, and
[ADR 0003](docs/adr/0003-vendored-schema-and-mock-first-commerce.md) records why
`@sentra/sdk-commerce` vendors its schema and runs mock-first rather than against a live
store.

## Applications

| App               | What it does                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/storefront` | A Vue 3 storefront built on `@sentra/sdk-commerce` and `@sentra/ui`: a virtualised product listing, a product detail page, and a cart drawer that hands off checkout to Shopify's hosted, PCI-compliant page. Runs entirely against MSW fixtures by default — see [its README](apps/storefront/README.md) for the demo controls that trigger every error state live. |

```bash
cp apps/storefront/.env.example apps/storefront/.env.local
pnpm --filter @sentra/storefront dev
```

## Getting started

Prerequisites: Node `>= 24.15.0` (see `.nvmrc`) and pnpm `>= 10.34.5`.

```bash
pnpm install
pnpm build        # generates tokens CSS, then builds the ui library
pnpm test         # 353 tests across all packages; the tokens suite also passes under Jest (ADR 0002)
pnpm --filter @sentra/ui storybook   # component workbench on :6006
```

## Scripts

| Command                                | What it runs                                                           |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm build`                           | Turborepo build graph (`tokens` before `ui`, by dependency)            |
| `pnpm test`                            | Vitest suites in every package                                         |
| `pnpm typecheck`                       | `tsc --noEmit` / `vue-tsc --noEmit` per package                        |
| `pnpm lint`                            | ESLint flat config — `vue/no-v-html` is enforced as a security control |
| `pnpm format:check`                    | Prettier verification (CI-blocking)                                    |
| `pnpm --filter @sentra/storefront e2e` | Playwright smoke suite against the production storefront build         |

CI now runs three jobs on every push and pull request — `verify` (format, lint, build,
typecheck, test, the `tokens` Jest suite, and the Storybook build), `interactions`
(Storybook's play functions and a11y checks in a real browser), and `e2e` (the Playwright
suite against the built storefront) — with the Storybook static build and, on failure, the
Playwright report, uploaded as artifacts.

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

- Runtime micro-frontend shell wiring per ADR 0001
- `apps/console` — an internal ops remote (orders table, feature-flag toggles),
  deliberately a different application shape from the storefront

## License

[MIT](LICENSE) © 2026 Bara Yuda
