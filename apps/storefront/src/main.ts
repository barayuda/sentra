import {
  analyticsPlugin,
  captureWebVitals,
  instrumentRouter,
  useAnalytics,
} from '@sentra/plugin-analytics'
import { storefrontPlugin } from '@sentra/sdk-commerce/vue'
import { toastPlugin } from '@sentra/ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { createStorefrontAnalyticsTransport, storefrontEventSchema } from './analytics.ts'
import { router } from './router.ts'
import { getStorefrontClient, mocksEnabled } from './storefront.ts'
import './styles.css'

/**
 * Boots the application.
 *
 * The mock worker starts and settles *before* `createApp`, because a component
 * that issues a request before the Service Worker is intercepting reaches the
 * real network — a race that only shows up on slow machines and in CI.
 *
 * The dynamic import matters too: a production build with mocks disabled never
 * evaluates the module, so MSW and the fixtures are tree-shaken out of the
 * bundle rather than shipped as dead weight.
 */
async function bootstrap(): Promise<void> {
  if (mocksEnabled()) {
    const { startMockWorker } = await import('./mocks/browser.ts')
    await startMockWorker()
  }

  const app = createApp(App)

  app.use(createPinia())
  app.use(router)
  app.use(toastPlugin)
  app.use(analyticsPlugin, {
    schema: storefrontEventSchema,
    transport: createStorefrontAnalyticsTransport(),
  })
  app.use(storefrontPlugin, { client: getStorefrontClient() })

  /**
   * `analyticsPlugin` owns its client, so retrieving it outside a component
   * means running `useAnalytics()` inside the app's injection context.
   * `app.runWithContext` exists for exactly this: it is the sanctioned way to
   * use an injection outside `setup()`, and it avoids the alternative of
   * constructing a second client that would batch and flush independently of
   * the one every component sees.
   */
  const analytics = app.runWithContext(() => useAnalytics())
  instrumentRouter(router, analytics)
  captureWebVitals(analytics)

  await router.isReady()
  app.mount('#app')
}

void bootstrap()
