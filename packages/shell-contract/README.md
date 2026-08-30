# @sentra/shell-contract

**Role:** platform core — kept when the reference implementation is removed.

## What it does

The contract between `apps/shell` and every remote it can mount — currently
`apps/storefront` and `apps/console`. A remote is not a mounted sub-application with its
own router and its own `App` instance; it is **routes, plus an optional overlay, plus a
registration hook**, because the shell owns the only router, the only history, and the
only URL on the page. `RemoteModule` is that contract, `ShellEventMap` is the fixed set of
events a remote and the shell may exchange, and `parseRemoteManifest` is what the shell
validates `apps/shell/public/remotes.json` against before it registers or loads anything.
See ADR 0004 for the manifest, ADR 0005 for what is shared across the boundary, and
ADR 0006 for the event bus.

## How to use it

The whole `RemoteModule` contract, minimally:

```ts
import type { RemoteModule } from '@sentra/shell-contract'

const myRemote = {
  /** Relative paths — no leading slash — grafted under the shell's basePath. */
  routes: [{ path: '', name: 'my-remote-home', component: HomeView }],

  /** Installs whatever this remote's views need. Runs once, before mount. */
  register(app, ctx) {
    app.use(myPlugin, { bus: ctx.bus })
  },
} satisfies RemoteModule

export default myRemote
```

`register`'s second argument, `RemoteContext`, hands the remote `ctx.bus`, the
shell's live `ShellBus` instance, and `ctx.basePath`, the URL prefix the manifest mounted
this remote under. `register` is the one call both modes share — the shell calls it once
per remote before mounting its own `App`, and each remote's own standalone `main.ts` calls
the identical function to boot itself, which is what keeps a federated regression from
also failing that remote's own dev server and its own end-to-end suite.

`ShellEventMap` (`src/bus.ts`) is a **closed** map, with no
`emit(name: string, data: unknown)` escape hatch a call site could invent at runtime:

| Event                 | Payload                            | Carries                                              |
| --------------------- | ---------------------------------- | ---------------------------------------------------- |
| `cart:updated`        | `{ totalQuantity: number }`        | A cart's line total changed.                         |
| `cart:open-requested` | `{ origin: string }`               | Something asked for the cart overlay.                |
| `session:changed`     | `{ session: Session \| null }`     | The signed-in user changed, including to signed out. |
| `remote:failed`       | `{ name: string; reason: string }` | A remote could not be loaded or registered.          |

Adding a fifth event means editing this file — a reviewed change to a shared contract,
not a string any call site can invent on its own.

```ts
import { useShellBus } from '@sentra/shell-contract'

const bus = useShellBus()
const stop = bus.on('cart:updated', ({ totalQuantity }) => {
  /* … */
})
```

## What it depends on

`@sentra/result`, as a runtime dependency — `ManifestError` is a `Result` error shape.
`vue` and `vue-router` are **peer** dependencies, not runtime ones
(`peerDependencies: { "vue": "^3.5.0", "vue-router": "^5.0.0" }`) — this package must
never carry its own bundled copy of either. Every real consumer already provides both as
its own shared, `singleton: true` federation dependency (ADR 0005); a second, independent
copy of `vue` bundled inside this contract package would recreate the exact duplicated-
`Symbol` failure ADR 0005 exists to prevent for `vue-router` and Pinia — unlike this
package's own injection keys, which are plain strings and so tolerate duplication safely.
