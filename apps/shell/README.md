# @sentra/shell

**Role:** platform core — kept when the reference implementation is removed.

## What it is

The host application: it owns the only Vue app instance, the only `vue-router`
instance, and the only browser history on the page. It contributes chrome (a header,
a toast host, remote overlays) and composes whatever remotes a runtime manifest names —
today, `apps/storefront` at `/shop` and `apps/console` at `/ops`. See ADR 0001 for why
Module Federation, ADR 0004 for why remotes are registered at runtime instead of built
in, ADR 0005 for what is shared across the federation boundary, and ADR 0006 for how the
shell and a remote talk to each other without one importing the other.

## The boot sequence

`bootShell()` (`src/registry/boot.ts`) runs, in order:

1. **Mocks**, if `VITE_SENTRA_MOCKS=true` — before anything else, so the mock Service
   Worker controls the page before any remote's code can issue a request that escapes to
   the real network.
2. **Manifest fetch and validation** — `GET /remotes.json`, parsed and validated by
   `@sentra/shell-contract`'s `parseRemoteManifest`. A manifest that cannot be fetched or
   fails to parse degrades to zero remotes rather than throwing; a single malformed
   _entry_ is dropped (and logged) without discarding the entries that did parse.
3. **Registration** — every entry that parsed is passed to
   `registerRemotes(entries, { force: true })`, with `type: 'module'` hardcoded at this
   call site rather than read from the manifest (see ADR 0004 for why).
4. **Loading** — each registered remote is loaded concurrently with
   `loadRemote('<name>/remote')` and shape-checked against `RemoteModule`; a remote that
   fails either step becomes a failed outcome, never a thrown error that would take the
   whole shell down with it.
5. **App construction** — Pinia, the toast plugin, the shell's `ShellBus`, the session
   plugin, and the analytics plugin (installed with the _union_ of every loaded remote's
   `analyticsEvents` schema) are installed on one `App` instance.
6. **Per-remote wiring** — for each loaded remote: `module.register(app, { bus, basePath })`
   runs (installing whatever plugins that remote's own views need), its `overlay` (if any)
   is collected, and its `routes` are grafted under its `basePath` via `router.addRoute`.
   A failed remote instead gets a fallback route at its own `basePath` rendering
   `RemoteUnavailable`, so a dead remote reports "this is down," not "this page doesn't
   exist."
7. **Mount** — `router.isReady()`, then `app.mount('#app')`. Only after mounting does the
   shell emit `remote:failed` for anything that failed to load — emitting earlier would
   have zero subscribers, since `ShellBus.emit` delivers synchronously with no replay
   buffer.

## `remotes.json`

`apps/shell/public/remotes.json` is a JSON array, one object per remote:

```json
[
  { "name": "storefront", "entry": "http://127.0.0.1:4173/remoteEntry.js", "basePath": "/shop" },
  { "name": "console", "entry": "http://127.0.0.1:4174/remoteEntry.js", "basePath": "/ops" }
]
```

- `name` must match the remote's own `federation({ name })`.
- `entry` must be an absolute `http:` or `https:` URL — anything else is rejected
  (ADR 0004's supply-chain control).
- `basePath` must start with `/`, must not be exactly `/`, must not end with `/`, and
  must not contain a wildcard.

**Repointing a remote without rebuilding the shell** is exactly this: edit
`remotes.json` — a static asset served alongside the shell's build, not baked into it —
and reload. No shell code, config, or build is involved.

## `?break=<name>`

`apps/shell/src/registry/break.ts` reads `?break=<name>` from the URL (repeatable, or
comma-joined in one occurrence) and forces the named remote(s) to fail to load — a way to
demonstrate or exercise the degrade-gracefully path without stopping a server, e.g.
`http://localhost:4175/ops/orders?break=console`.

**This control is gated on `mocksEnabled()`** at its call site in `boot.ts` — it has no
effect unless `VITE_SENTRA_MOCKS=true`. A real deployment carries no mocks flag, so a
visitor cannot use a query string to take a remote down on a production host. Named risk
area: access control.

## Troubleshooting

- **`#RUNTIME-001 — Failed to get remoteEntry exports`, with `Cannot use import statement
outside a module` in the browser console.** The remote entry was loaded as a classic
  script. The shell passes `type: 'module'` at the `registerRemotes` call site for exactly
  this reason (ADR 0004); the symptom returns if that is ever dropped.
- **A remote's `pnpm dev` prints `ready in …ms` and then exits with an uncaught
  `Command failed: … tsc --showConfig`.** The remote package is missing its
  `tsconfig.json`. The federation DTS plugin's background worker cannot read the file and
  crashes the dev server outright rather than degrading. Every real remote here ships a
  `tsconfig.json`, so this should not occur in practice — but the crash names neither
  federation nor the missing file, so it belongs here.
- **A remote fails to load with a connection-refused error, and nothing about the
  manifest or the remote's own code looks wrong.** Check what the preview server actually
  bound to. `vite preview`'s default host is `localhost`, and on a dual-stack loopback
  Node can resolve `localhost` to a single address — on the machine this was diagnosed
  on, `::1` only — leaving `127.0.0.1` connection-refused. `remotes.json` pins
  `http://127.0.0.1:4173` and `:4174`, so the shell reports this as a remote-load
  failure, when the actual fault sits one layer down: the server never bound to the
  address the manifest names. `apps/shell/playwright.config.ts` and
  `apps/storefront/playwright.config.ts` both pass `--host 127.0.0.1` to every preview
  server for exactly this reason, documented at their own source. The fix generalises:
  bind every preview server to `127.0.0.1` explicitly rather than relying on the
  `localhost` default.

Each entry above shares the same shape: the error message names a layer several steps
above where the fault actually lives.

## What it depends on

- `@module-federation/runtime` and `@module-federation/vite` — the registry and the
  build-time plugin the boot sequence above is built on.
- `vue`, `vue-router`, `pinia` — the app instance, the one router, and the one active
  store; all `singleton: true` across the federation boundary (ADR 0005).
- `@sentra/shell-contract` — the `RemoteModule`/`RemoteContext`/`ShellBus` contract every
  remote is loaded against.
- `@sentra/ui`, `@sentra/tokens` — the toast host and the design tokens the shell's own
  chrome is built from.
- `@sentra/plugin-analytics` — installed once here with the _union_ of every loaded
  remote's `analyticsEvents` schema, so one pipeline serves the whole platform.
- `@sentra/result` — the `Result<T, E>` shape `parseRemoteManifest`'s `ManifestError`
  returns (`src/registry/manifest.ts`).
- `@sentra/sdk-commerce` and `@sentra/sdk-ops` — not imported for their clients, but for
  their `/mocks` subpaths: `src/mocks/browser.ts` assembles **one** MSW Service Worker
  for the whole platform from both SDKs' mock handler factories, because a page gets
  exactly one Service Worker registration per scope — two remotes each calling
  `setupWorker()` would not compose, so the shell owns the worker and each remote's
  federated module stays free of a dev-only mocking concern.

`@sentra/storefront` and `@sentra/console` are listed in `package.json`'s
`devDependencies`, not `dependencies` — and purely so Turborepo's build graph builds both
remotes before the shell in `turbo run build`. No file under `apps/shell/src`,
`apps/shell/e2e`, `vite.config.ts`, or `vitest.config.ts` imports either package —
checkable with:

```bash
grep -rl "@sentra/storefront\|@sentra/console" apps/shell/src apps/shell/e2e apps/shell/vite.config.ts apps/shell/vitest.config.ts
```

which returns nothing. That absence is the federation claim made concrete: if the shell
imported a remote, that remote would be a build-time dependency of the host, and this
platform would be a monolith with extra deploy steps rather than a federated one.
