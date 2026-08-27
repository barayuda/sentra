# Sentra

[![CI](https://github.com/barayuda/sentra/actions/workflows/ci.yml/badge.svg)](https://github.com/barayuda/sentra/actions/workflows/ci.yml)

Sentra is a front-end platform monorepo: a design-token pipeline, an accessible Vue 3
component library, and the shared tooling that keeps every workspace on one set of rules.
It is built so that multiple teams can ship into one storefront without colliding — shared
foundations here, independent deploy cadence at the edges.

## What's inside

| Package                    | What it does                                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sentra/tokens`           | Design tokens as a typed TypeScript source of truth. A build step **generates** the CSS — a Tailwind 4 `@theme` block plus `:root` custom properties, dark and compact-density override blocks — so one edit propagates to every consumer.                    |
| `@sentra/ui`               | Vue 3 component library — ten components (`Button`, `Input`, `Select`, `Checkbox`, `Combobox`, `Dialog`, `DataTable`, `Toast`, `Money`, `ProductCard`) with an enforced accessibility baseline, documented in Storybook where a11y violations fail the build. |
| `@sentra/plugin-analytics` | Schema-validated, allowlist-only analytics as a Vue plugin — a field not named in the schema never leaves the page. Behavioural events and Web Vitals share one pipeline.                                                                                     |
| `@sentra/config`           | Shared tool configuration: the strict `tsconfig` base every package extends and a Vitest config factory.                                                                                                                                                      |

Each package has its own README covering what it does, how to use it, and what it depends
on. Architecture decisions live in [`docs/adr/`](docs/adr/): [ADR 0001](docs/adr/0001-federation-plugin-choice.md)
records the runtime micro-frontend evaluation (Module Federation on Vite) that shapes the
application layer, and [ADR 0002](docs/adr/0002-vitest-and-jest.md) records the Vitest/Jest
dual-runner decision, with the `tokens` suite as the running evidence.

## Getting started

Prerequisites: Node `>= 24.15.0` (see `.nvmrc`) and pnpm `>= 10.34.5`.

```bash
pnpm install
pnpm build        # generates tokens CSS, then builds the ui library
pnpm test         # 146 tests across all packages; the tokens suite also passes under Jest (ADR 0002)
pnpm --filter @sentra/ui storybook   # component workbench on :6006
```

## Scripts

| Command             | What it runs                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm build`        | Turborepo build graph (`tokens` before `ui`, by dependency)            |
| `pnpm test`         | Vitest suites in every package                                         |
| `pnpm typecheck`    | `tsc --noEmit` / `vue-tsc --noEmit` per package                        |
| `pnpm lint`         | ESLint flat config — `vue/no-v-html` is enforced as a security control |
| `pnpm format:check` | Prettier verification (CI-blocking)                                    |

CI runs the same gates in the same order on every push and pull request; the Storybook
static build is uploaded as an artifact on each run.

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

## Roadmap

- `@sentra/sdk-commerce` — a typed Shopify Storefront client, mock-first via MSW
- Runtime micro-frontend shell wiring per ADR 0001

## License

[MIT](LICENSE) © 2026 Bara Yuda
