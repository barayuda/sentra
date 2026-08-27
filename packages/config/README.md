# @sentra/config

## What it does

Holds the tool configuration every Sentra package inherits, so rules are defined once
rather than copied per package. Two things ship here: a base `tsconfig` and a Vitest
config factory.

## How to use it

Extend the TypeScript base from a package `tsconfig.json`:

```json
{ "extends": "@sentra/config/tsconfig-base.json" }
```

Build a Vitest config from the factory:

```ts
import { defineVitestConfig } from '@sentra/config/vitest'

export default defineVitestConfig({ environment: 'happy-dom' })
```

`environment` defaults to `node` and `setupFiles` defaults to `[]`, so a package with no
DOM and no setup needs no arguments at all.

A few base-config choices are load-bearing and will surprise you if you fight them:

- `allowImportingTsExtensions` is on, so relative imports write the literal extension
  (`./flatten.ts`). This is required because `@sentra/tokens` executes a build script
  through `node`, whose native type stripping does no extension resolution.
- `noEmit` is on, which is what makes the flag above legal. TypeScript never emits in this
  repository: Vite emits JavaScript, `vite-plugin-dts` emits declarations, and every
  `typecheck` script is `--noEmit`.
- Root `typescript` is pinned to `7.0.2`, but `packages/ui`'s `typescript` devDependency is
  aliased to `npm:@typescript/typescript6@6.0.2` — `vue-tsc` cannot run against TS7's Go
  compiler yet. The root `.pnpmfile.cjs` applies the same TS6 alias to
  `typescript-eslint` and its `@typescript-eslint/*` dependents, which throw at import time
  under TS7. Both are compatibility shims for tooling that hasn't caught up, not a change
  to this package's own config.

## What it depends on

`typescript` and `vitest`, both as devDependencies. It has no runtime dependencies and
ships no runtime code — the Vitest factory runs only inside config files.
