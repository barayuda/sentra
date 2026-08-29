import { loadRemote, registerRemotes } from '@module-federation/runtime'
import { analyticsPlugin } from '@sentra/plugin-analytics'
import {
  createSessionPlugin,
  createShellBus,
  shellBusPlugin,
  type RemoteModule,
} from '@sentra/shell-contract'
import { RemoteUnavailable, toastPlugin, useToast } from '@sentra/ui'
import { createPinia } from 'pinia'
import { createApp, h, type Component } from 'vue'
import { createRouter, createWebHistory, RouterView, type RouteRecordRaw } from 'vue-router'
import { createShellAnalyticsTransport } from '../analytics.ts'
import App from '../App.vue'
import { createRoleGuard } from '../guards.ts'
import { mocksEnabled } from '../mocks/enabled.ts'
import { REMOTE_OVERLAYS_INJECTION_KEY } from '../remote-overlays.ts'
import { initialSession } from '../session.ts'
import ForbiddenView from '../views/ForbiddenView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import { brokenRemoteNames } from './break.ts'
import { loadRemotes, type RemoteLoadOutcome } from './load.ts'
import { fetchRemoteManifest } from './manifest.ts'
import { mergeEventSchemas } from './schema.ts'

/** Where the manifest lives. Same-origin, served from `public/`. */
const MANIFEST_URL = '/remotes.json'

/**
 * A remote's parent route needs *some* component to render its children
 * under `basePath`. It cannot be `{ template: '<RouterView />' }`: Vite
 * resolves the `vue` import to the runtime-only build
 * (`dist/vue.runtime.esm-bundler.js`, per `vue`'s `package.json#exports`),
 * which has no template compiler and throws
 * `Component provided template option but runtime compilation is not
 * supported` the first time this route renders. A render function needs no
 * compiler, so it works in that build.
 */
const REMOTE_HOST: Component = { render: () => h(RouterView) }

/**
 * Builds the routes a failed remote leaves behind.
 *
 * A failed remote still owns its base path. Without this, `/ops/orders` would
 * fall through to the 404 view and tell the operator the page does not exist,
 * when in fact it exists and is down — two very different things to be told
 * during an incident.
 */
function fallbackRoutes(
  outcome: Extract<RemoteLoadOutcome, { status: 'failed' }>,
): RouteRecordRaw[] {
  return [
    {
      path: `${outcome.entry.basePath}/:pathMatch(.*)*`,
      name: `remote-unavailable-${outcome.entry.name}`,
      component: RemoteUnavailable,
      props: { name: outcome.entry.name, reason: outcome.reason },
    },
  ]
}

/** Boots the shell. Never throws for a remote's sake. */
export async function bootShell(): Promise<void> {
  /* 1. Mocks first. The worker must control the page before any remote code
        runs, or the storefront's first request escapes to the network.
        Gated on `mocksEnabled()`, not `import.meta.env.DEV`: the federated
        E2E suite drives this against a preview build, and `DEV` is false in
        a preview build, so a `DEV` check would silently turn mocking off
        under the exact conditions the suite runs in. */
  if (mocksEnabled()) {
    const { startShellMocks } = await import('../mocks/browser.ts')
    await startShellMocks()
  }

  /* 2. Manifest. A failure here is survivable: the shell boots with chrome,
        a 404 route, and — when there is nothing left to route to — a
        platform-level `RemoteUnavailable` at `/`. A missing or malformed
        manifest is an infrastructure problem, not an authorization one, so
        it must never resolve to a `/forbidden` redirect. */
  const manifest = await fetchRemoteManifest(MANIFEST_URL)
  const parsed = manifest.ok ? manifest.value : { entries: [], rejected: [] }
  if (!manifest.ok) {
    console.error('[sentra] remote manifest unavailable:', manifest.error.message)
  }
  for (const rejection of parsed.rejected) {
    console.error(`[sentra] manifest entry ${rejection.index} rejected: ${rejection.reason}`)
  }

  /* 3. Registration, then loading. `force: true` lets a re-register replace an
        entry rather than being ignored — see ADR 0004 and the Task 1 spike.

        `type: 'module'` is hardcoded, not read from the manifest. Module
        Federation's script loader defaults a remote entry to a
        classic `<script>`, but `@module-federation/vite` only ever emits an
        ES module, so without this the browser throws `Cannot use import
        statement outside a module` and the runtime reports it as the opaque
        `RUNTIME-001 — Failed to get remoteEntry exports`. Every remote on
        this platform is Vite-built and therefore always a module: a field
        that never varies is a knob that can only ever be set wrong, and
        `remotes.json` is the one file advertised as hand-editable in a
        deployed `dist/`. Hardcoding keeps the manifest's editable surface to
        the two things an operator actually changes — which remote, and where
        it lives. */
  registerRemotes(
    parsed.entries.map((entry) => ({
      name: entry.name,
      entry: entry.entry,
      type: 'module' as const,
    })),
    { force: true },
  )

  /* Gated on the mocks flag, not `import.meta.env.DEV`: the E2E suite
     drives `?break=` against a preview build, where `DEV` is false, so a
     `DEV` check would never fire there. A real deployment sets no mocks
     flag, so a visitor cannot disable a remote with a query string. */
  const broken = mocksEnabled() ? brokenRemoteNames(globalThis.location.search) : new Set<string>()

  const outcomes = await loadRemotes(parsed.entries, async (name) => {
    if (broken.has(name)) throw new Error('remote disabled by ?break for demonstration')
    return (await loadRemote<{ default: RemoteModule }>(`${name}/remote`))!.default
  })

  /* 4. The app. Built after loading because the analytics schema is the union
        of the remotes' schemas, and a plugin cannot be re-installed. */
  const loaded = outcomes.filter(
    (outcome): outcome is Extract<RemoteLoadOutcome, { status: 'loaded' }> =>
      outcome.status === 'loaded',
  )
  const failed = outcomes.filter(
    (outcome): outcome is Extract<RemoteLoadOutcome, { status: 'failed' }> =>
      outcome.status === 'failed',
  )

  /* An empty or broken manifest is an infrastructure failure, not an
     authorization failure — it must not redirect to `/forbidden`. When
     there are no usable entries at all, `/` renders `RemoteUnavailable`
     naming "The platform", with a reason that keeps the two failure cases
     distinct: a manifest that could not be fetched or parsed reports its
     own error message, while a manifest that parsed fine but listed
     nothing says so explicitly. */
  const rootRoute: RouteRecordRaw =
    parsed.entries.length === 0
      ? {
          path: '/',
          name: 'platform-unavailable',
          component: RemoteUnavailable,
          props: {
            name: 'The platform',
            reason: manifest.ok
              ? 'No remotes are registered in remotes.json.'
              : manifest.error.message,
          },
        }
      : { path: '/', redirect: parsed.entries[0]!.basePath }

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      rootRoute,
      { path: '/forbidden', name: 'forbidden', component: ForbiddenView },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
    ],
  })

  /* No hand-rolled no-op bus here: `createShellBus()` is cheap and safe to
     construct unconditionally, including when there are zero entries — the
     header still mounts and still needs a real bus. `NULL_BUS` stays
     reserved for the `inject()` default at call sites, per its own doc
     comment in `@sentra/shell-contract`. */
  const bus = createShellBus()
  const { plugin: sessionPlugin, session } = createSessionPlugin(initialSession())
  router.beforeEach(createRoleGuard(() => session.value))

  const app = createApp(App)
  app.use(createPinia())
  app.use(toastPlugin)
  app.use(shellBusPlugin, bus)
  app.use(sessionPlugin)
  /* `analyticsPlugin` is a plugin object, not a factory — it is installed
     as `app.use(analyticsPlugin, options)`, not
     `app.use(analyticsPlugin(options))`. */
  app.use(analyticsPlugin, {
    schema: mergeEventSchemas(loaded.map((outcome) => outcome.module.analyticsEvents ?? {})),
    transport: createShellAnalyticsTransport(),
  })

  /* 5. Register each remote, then add its routes under its base path. Register
        before addRoute: a route may resolve immediately after `isReady()`, and
        a component that renders before its remote's plugins are installed
        throws from `inject`. */
  const overlays: Component[] = []
  for (const outcome of loaded) {
    outcome.module.register(app, { bus, basePath: outcome.entry.basePath })
    if (outcome.module.overlay) overlays.push(outcome.module.overlay)
    router.addRoute({
      path: outcome.entry.basePath,
      /* An unnamed parent with children keeps the remote's own paths relative,
         so a remote never hardcodes where it is mounted. */
      component: REMOTE_HOST,
      children: [...outcome.module.routes],
    })
  }

  /* `remote:failed` is collected here and emitted only after `app.mount()`,
     below. `ShellBus.emit` delivers synchronously to whatever is subscribed
     *right now* and keeps no replay buffer — emitting before mount would
     have zero subscribers and silently drop the event. */
  const bootFailures: { name: string; reason: string }[] = []
  for (const outcome of failed) {
    console.error(`[sentra] remote ${outcome.entry.name} failed: ${outcome.reason}`)
    bootFailures.push({ name: outcome.entry.name, reason: outcome.reason })
    for (const route of fallbackRoutes(outcome)) router.addRoute(route)
  }

  app.provide(REMOTE_OVERLAYS_INJECTION_KEY, overlays)
  app.use(router)
  await router.isReady()
  app.mount('#app')

  /*
   * `remote:failed` gets its one production subscriber here: a danger toast.
   * `useToast()` is an injection, so it needs the app's context —
   * `app.runWithContext` is the sanctioned way to read one outside `setup()`,
   * the same pattern `apps/storefront/src/main.ts` and
   * `apps/storefront/src/federated/register.ts` use for `useAnalytics()`.
   *
   * Why a toast does not double-report a failure `RemoteUnavailable` already
   * shows: `RemoteUnavailable` only renders for whoever is actually looking
   * at the failed remote's own route (`fallbackRoutes`, above) — it says
   * nothing to someone on `/`, or on a different, healthy remote, who has no
   * other way to learn that part of the platform is down. The toast exists
   * for exactly that second audience. The one case where both could fire —
   * someone whose very first URL already resolves to the failed remote's
   * fallback route — is where they *would* genuinely see the same failure
   * twice, so that case is the one skipped below by comparing the toast's
   * target against the route actually rendered right now.
   */
  const toast = app.runWithContext(() => useToast())
  bus.on('remote:failed', ({ name, reason }) => {
    if (router.currentRoute.value.name === `remote-unavailable-${name}`) return
    toast.show({
      title: `${name} is unavailable`,
      description: reason,
      variant: 'danger',
    })
  })

  /* Now that the app is mounted and any remote's `register()` has had the
     chance to subscribe, publish each boot-time failure. */
  for (const failure of bootFailures) {
    bus.emit('remote:failed', failure)
  }
}
