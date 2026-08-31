import { createFlagClient, flagsPlugin } from '@sentra/flags'
import { createI18n, i18nPlugin } from '@sentra/i18n'
import {
  analyticsPlugin,
  captureWebVitals,
  instrumentRouter,
  useAnalytics,
} from '@sentra/plugin-analytics'
import { consoleSink, errorsPlugin, useErrors } from '@sentra/plugin-errors'
import { createShellBus, shellBusPlugin } from '@sentra/shell-contract'
import { uiMessages } from '@sentra/ui/i18n'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { consoleEventSchema, createConsoleAnalyticsTransport } from './analytics.ts'
import consoleRemote from './federated/index.ts'
import { CONSOLE_FLAGS, createOpsFlagSource } from './flags.ts'
import { useOps } from './ops.ts'

/**
 * Whether this build serves data from MSW fixtures.
 *
 * Mock-first is the demo posture, not a testing convenience: M4 has no real
 * ops backend, so a mock-free build would have nothing to talk to at all.
 */
function mocksEnabled(): boolean {
  return import.meta.env.VITE_SENTRA_MOCKS === 'true'
}

/**
 * vue-router rejects a relative `path` on a top-level route record — only
 * `children` may omit the leading slash. `consoleRemote.routes` are
 * deliberately relative (spec §3.1: a leading slash would force the console
 * to the site root regardless of where a host mounts it), so standalone mode
 * has to perform the same join any shell would when mounting a remote at its
 * `basePath`. Standalone mounts at the root, hence `''`.
 */
function toAbsolutePath(basePath: string, path: string): string {
  const joined = `${basePath}/${path}`
  return joined.startsWith('/') ? joined : `/${joined}`
}

/**
 * Boots the console on its own.
 *
 * Everything here is the host-shaped scaffolding the shell would otherwise
 * supply: a router, a Pinia, a bus, an analytics client. What it deliberately
 * does *not* do is define a second set of routes or a second `register` — it
 * drives `federated/index.ts`, the same module the shell loads. A regression
 * in the federated entry therefore fails the console's own standalone build,
 * which is the point of dual-mode.
 *
 * The mock worker starts and settles before `createApp`, because a component
 * that issues a request before the Service Worker is intercepting reaches the
 * real network — a race that only shows up on slow machines and in CI. The
 * dynamic import keeps MSW and the fixtures out of a production bundle.
 */
async function bootstrap(): Promise<void> {
  if (mocksEnabled()) {
    const { startMockWorker } = await import('./mocks/browser.ts')
    await startMockWorker()
  }

  const router = createRouter({
    history: createWebHistory(),
    routes: consoleRemote.routes.map((route) => ({
      ...route,
      path: toAbsolutePath('', route.path),
    })),
    scrollBehavior: () => ({ top: 0 }),
  })

  const app = createApp(App)
  const bus = createShellBus()

  /*
   * Installed first, before anything else, so that every later `app.use()`
   * runs inside its capture path: `installErrorSources`
   * (`packages/plugin-errors/src/sources.ts:19-51`) is what wires
   * `app.config.errorHandler` and the `window`/`document` listeners, and
   * until it installs there is no capture path at all. If any later install
   * throws, `bootstrap()`'s remaining body never runs, so the throw would
   * otherwise escape as an unhandled rejection with nothing listening. Both
   * `onError` (flags) and `onMissing` (i18n) route into the reporter this
   * install provides.
   */
  app.use(errorsPlugin, { sink: consoleSink(), allowedContextKeys: ['view', 'key', 'locale'] })

  /**
   * `errorsPlugin` owns its reporter, so retrieving it outside a component
   * means running `useErrors()` inside the app's injection context.
   * `app.runWithContext` avoids constructing a second reporter that would
   * track its own `maxPerSession` count independently of the one every
   * component sees.
   */
  const reporter = app.runWithContext(() => useErrors())

  app.use(createPinia())
  app.use(router)
  app.use(shellBusPlugin, bus)
  app.use(analyticsPlugin, {
    schema: consoleEventSchema,
    transport: createConsoleAnalyticsTransport(),
  })
  consoleRemote.register(app, { bus, basePath: '' })

  /**
   * `consoleRemote.register` already installed `opsPlugin` with a client
   * (`apps/console/src/federated/register.ts:18`); retrieve that one rather
   * than constructing a second, independent client that would be discarded
   * unused.
   */
  const opsClient = app.runWithContext(() => useOps())

  /**
   * The console consumes only `ui.*` keys, so it installs `@sentra/ui`'s
   * catalogue and ships none of its own. Locale is fixed at `'en'` to match
   * `index.html`. `onMissing` reports through the same reporter as the flags
   * `onError` above — see `apps/storefront/src/main.ts:28-34` for the richer
   * `missingTranslationError` treatment that distinguishes a missing key from
   * an unmatched placeholder; deliberately not duplicated here.
   */
  const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: uiMessages,
    onMissing: (key, locale) => {
      reporter.report(new Error(`missing translation: ${key}`), { key, locale })
    },
  })
  app.use(i18nPlugin, i18n)

  const flags = createFlagClient({
    declarations: CONSOLE_FLAGS,
    source: createOpsFlagSource(opsClient),
    allowOverrides: import.meta.env.DEV,
    onError: (error) => reporter.report(error, { view: 'flags' }),
  })
  app.use(flagsPlugin, flags)
  void flags.refresh()

  /**
   * `analyticsPlugin` owns its client, so retrieving it outside a component
   * means running `useAnalytics()` inside the app's injection context.
   * `app.runWithContext` exists for exactly this: it is the sanctioned way to
   * use an injection outside `setup()`, and it avoids constructing a second
   * client that would batch and flush independently of the one every
   * component sees.
   */
  const analytics = app.runWithContext(() => useAnalytics())
  instrumentRouter(router, analytics)
  captureWebVitals(analytics)

  await router.isReady()
  app.mount('#app')
}

void bootstrap()
