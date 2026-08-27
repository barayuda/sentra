/**
 * @sentra/plugin-analytics — schema-validated, allowlist-only analytics for
 * Vue applications. Install with `app.use(analyticsPlugin, { schema, transport })`.
 */
export {
  createAnalytics,
  type AnalyticsClient,
  type AnalyticsEvent,
  type AnalyticsEventProps,
  type EventSchema,
  type Transport,
} from './events.ts'
export { consoleTransport, beaconTransport, batchTransport } from './transports.ts'
export {
  analyticsPlugin,
  useAnalytics,
  ANALYTICS_INJECTION_KEY,
  type AnalyticsPluginOptions,
} from './plugin.ts'
export { createTrackDirective, type TrackBinding } from './directive.ts'
export { instrumentRouter } from './router.ts'
export { captureWebVitals, type VitalMetric, type VitalsReporters } from './vitals.ts'
