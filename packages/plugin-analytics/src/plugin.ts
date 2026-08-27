import { inject, type InjectionKey, type Plugin } from 'vue'
import {
  createAnalytics,
  type AnalyticsClient,
  type EventSchema,
  type Transport,
} from './events.ts'
import { createTrackDirective } from './directive.ts'

/** String-keyed so tests can provide a client without importing this instance. */
export const ANALYTICS_INJECTION_KEY =
  'sentra:analytics' as unknown as InjectionKey<AnalyticsClient>

/** Options for {@link analyticsPlugin}. */
export interface AnalyticsPluginOptions {
  schema: EventSchema
  transport: Transport
}

/**
 * Vue plugin: `app.use(analyticsPlugin, { schema, transport })` creates one
 * client per app, provides it app-wide, and registers the `v-track`
 * directive bound to that client.
 */
export const analyticsPlugin: Plugin<[AnalyticsPluginOptions]> = {
  install(app, options) {
    const client = createAnalytics(options)
    app.provide(ANALYTICS_INJECTION_KEY, client)
    app.directive('track', createTrackDirective(client))
  },
}

/**
 * Returns the app's analytics client.
 *
 * @throws When the plugin is not installed — the message names the fix.
 */
export function useAnalytics(): AnalyticsClient {
  const client = inject(ANALYTICS_INJECTION_KEY)
  if (!client) {
    throw new Error('useAnalytics() requires app.use(analyticsPlugin, options) before mount.')
  }
  return client
}
