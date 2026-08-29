import { batchTransport, consoleTransport, type EventSchema } from '@sentra/plugin-analytics'

/**
 * The events the console emits.
 *
 * `page_view` and `web_vital` are declared identically to the storefront's,
 * on purpose. Merging two remotes' schemas must tolerate a shared event that
 * both genuinely emit — every remote has page views — while still rejecting
 * two remotes that disagree about what an event's categories are. Spec §3.2.
 */
export const consoleEventSchema = {
  page_view: ['path', 'name'],
  web_vital: ['metric', 'value', 'rating'],
  /** Sent by `OrdersView` when a column header changes the active sort. */
  ops_order_sorted: ['key', 'direction'],
  /** Sent by Task 9's flags view when an operator toggles a feature flag. */
  ops_flag_toggled: ['key', 'enabled'],
  /** Failure telemetry keyed on the ops error taxonomy's `kind`; see `@sentra/sdk-ops`. */
  ops_error: ['kind'],
} as const satisfies EventSchema

/** Builds the console's transport. Batched, so a sort burst is one flush. */
export function createConsoleAnalyticsTransport() {
  return batchTransport(consoleTransport(), { maxSize: 20, flushMs: 5000 })
}
