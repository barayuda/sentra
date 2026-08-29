# @sentra/console

## What it is

The ops console: an orders table and feature-flag toggles, built on `@sentra/sdk-ops`.
It is deliberately a different application shape from `apps/storefront` — no cart, no
product catalogue, a REST-shaped backend instead of a GraphQL one — so the shell's
composition is proven against two remotes that don't look alike, not two storefronts
side by side.

## How you use it

Dual-mode, like the storefront: the same `src/federated/index.ts` entry point drives
both `main.ts` (standalone) and the shell's federated load.

**Standalone**, on its own port, against its own mock backend:

```bash
VITE_SENTRA_MOCKS=true pnpm --filter @sentra/console dev       # http://localhost:5174
```

There is no `.env.example` here yet (unlike the shell and the storefront), so
`VITE_SENTRA_MOCKS` is passed on the command line above, or exported in the shell before
running `dev`/`build`/`preview`. `src/main.ts`'s own `mocksEnabled()` reads it the same
way both other apps do: `import.meta.env.VITE_SENTRA_MOCKS === 'true'`, with no fallback
to `import.meta.env.DEV` — unset means mocks off, even under `vite dev`.

```bash
VITE_SENTRA_MOCKS=true pnpm --filter @sentra/console build
pnpm --filter @sentra/console preview --port 4174 --strictPort   # http://localhost:4174
```

**Loaded by the shell**: `apps/shell/public/remotes.json` names `console` at
`http://127.0.0.1:4174/remoteEntry.js`, mounted under `/ops`. Build and preview the
console (above), then boot the shell (`apps/shell/README.md`) — it fetches
`remoteEntry.js` from `:4174` and grafts `consoleRoutes` under `/ops`.

Every console route requires `meta.requiresRole: 'ops'` (`src/federated/routes.ts`),
including the bare `/ops` index redirect — a redirect resolves during route matching,
before the shell's role guard runs, so leaving it unmarked would let an unauthorised
visitor learn that `/ops/orders` exists even while blocked from reaching it. Named risk
area: access control.

There is no `e2e` script in this app's `package.json`. The console's federated contract
is exercised by the shell's own federated suite instead
(`pnpm --filter @sentra/shell e2e`, `apps/shell/e2e/shell.spec.ts`), which is what
actually proves `consoleRemote` renders correctly under real shell chrome — a console-only
E2E run could not prove that on its own.

`preview: { cors: true }` in `vite.config.ts` is a local-preview convenience, not a
production setting: without it, the shell (origin `:4175`) cannot fetch this remote's
`remoteEntry.js` cross-origin at all, and the browser blocks the script outright. A real
deployment should allow-list the host's actual origin rather than reflecting every
origin. Named risk area: access control.

## What it depends on

`@sentra/sdk-ops` (the client), `@sentra/shell-contract` (`RemoteModule`, `ShellBus`,
`RouteMeta.requiresRole`), `@sentra/ui`, `@sentra/tokens`, and `@sentra/plugin-analytics`
— all workspace packages. `vue`, `vue-router`, and `pinia` are direct dependencies here
(not peers), matching every other container on this platform: each is `singleton: true`
in this app's own federation config, and ADR 0005 records why that pin is required for
these three specifically, and safe to skip for the `@sentra/*` packages above it.
