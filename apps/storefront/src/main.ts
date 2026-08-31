import {
  analyticsPlugin,
  captureWebVitals,
  instrumentRouter,
  useAnalytics,
} from '@sentra/plugin-analytics'
import { i18nPlugin } from '@sentra/i18n'
import { consoleSink, errorsPlugin, useErrors } from '@sentra/plugin-errors'
import { createShellBus, shellBusPlugin } from '@sentra/shell-contract'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { createStorefrontAnalyticsTransport, storefrontEventSchema } from './analytics.ts'
import storefrontRemote from './federated/index.ts'
import { syncDocumentLang, type SupportedLocale } from './i18n/locale.ts'
import { createStorefrontI18n } from './i18n/index.ts'
import { mocksEnabled } from './storefront.ts'

/**
 * vue-router rejects a relative `path` on a top-level route record — only
 * `children` may omit the leading slash. `storefrontRemote.routes` are
 * deliberately relative (spec §3.1: a leading slash would force the
 * storefront to the site root regardless of where a host mounts it), so
 * standalone mode has to perform the same join any shell would when mounting
 * a remote at its `basePath`. Standalone mounts at the root, hence `''`.
 */
function toAbsolutePath(basePath: string, path: string): string {
  const joined = `${basePath}/${path}`
  return joined.startsWith('/') ? joined : `/${joined}`
}

/**
 * Boots the storefront on its own.
 *
 * Everything here is the host-shaped scaffolding the shell would otherwise
 * supply: a router, a Pinia, a bus, an analytics client. What it deliberately
 * does *not* do is define a second set of routes or a second `register` — it
 * drives `federated/index.ts`, the same module the shell loads. A regression
 * in the federated entry therefore fails the storefront's own E2E suite,
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
    routes: storefrontRemote.routes.map((route) => ({
      ...route,
      path: toAbsolutePath('', route.path),
    })),
    scrollBehavior: () => ({ top: 0 }),
  })

  const app = createApp(App)
  const bus = createShellBus()

  /*
   * Installed before the i18n plugin so `onMissing`, below, has a reporter to
   * route into. This is the first composition point between two batteries
   * with no dependency between their packages.
   */
  app.use(errorsPlugin, { sink: consoleSink(), allowedContextKeys: ['key', 'locale'] })
  const reporter = app.runWithContext(() => useErrors())

  const i18n = createStorefrontI18n(reporter)
  syncDocumentLang(i18n.locale.value as SupportedLocale)

  app.use(createPinia())
  app.use(router)
  app.use(shellBusPlugin, bus)
  app.use(i18nPlugin, i18n)
  app.use(analyticsPlugin, {
    schema: storefrontEventSchema,
    transport: createStorefrontAnalyticsTransport(),
  })
  storefrontRemote.register(app, { bus, basePath: '' })

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
