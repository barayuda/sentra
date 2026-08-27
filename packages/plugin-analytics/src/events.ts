/** Primitive-only event properties — objects and arrays are not trackable by design. */
export type AnalyticsEventProps = Record<string, string | number | boolean>

/** A validated event as handed to transports. */
export interface AnalyticsEvent {
  name: string
  timestamp: number
  props: AnalyticsEventProps
}

/**
 * Event name → allowlisted prop keys. The allowlist IS the PII control:
 * a field that is not named here never leaves the page, no matter what a
 * call site passes. Prefer adding named fields over widening events.
 */
export type EventSchema = Record<string, readonly string[]>

/** Where validated events go. Implementations live in transports.ts. */
export interface Transport {
  send(events: readonly AnalyticsEvent[]): void
  /** Optional: batching transports expose an explicit flush. */
  flush?(): void
}

/** The tracking surface applications use, via useAnalytics() or directly. */
export interface AnalyticsClient {
  /** Validates against the schema and forwards to the transport. */
  track(name: string, props?: AnalyticsEventProps): void
  /** Flushes a batching transport; no-op for immediate transports. */
  flush(): void
}

/**
 * Creates an analytics client bound to a schema and a transport.
 *
 * Validation is allowlist-only: unknown event names are dropped, unknown
 * prop keys are stripped — each with a console warning so the mistake is
 * visible in development instead of silently shipping data.
 *
 * @param options.now - Clock override for deterministic tests.
 */
export function createAnalytics(options: {
  schema: EventSchema
  transport: Transport
  now?: () => number
}): AnalyticsClient {
  const { schema, transport, now = Date.now } = options

  function track(name: string, props: AnalyticsEventProps = {}): void {
    const allowed = schema[name]
    if (!allowed) {
      console.warn(`[analytics] dropped unknown event "${name}" — add it to the schema first.`)
      return
    }
    const filtered: AnalyticsEventProps = {}
    for (const [key, value] of Object.entries(props)) {
      if (allowed.includes(key)) {
        filtered[key] = value
      } else {
        console.warn(`[analytics] stripped prop "${key}" from "${name}" — not in the allowlist.`)
      }
    }
    transport.send([{ name, timestamp: now(), props: filtered }])
  }

  return { track, flush: () => transport.flush?.() }
}
