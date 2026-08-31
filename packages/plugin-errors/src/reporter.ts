import {
  fingerprintOf,
  redact,
  sanitizeUrl,
  type ErrorKind,
  type ErrorReport,
  type ErrorSink,
} from './report.ts'

/** Options for {@link createErrorReporter}. */
export interface CreateErrorReporterOptions {
  readonly sink: ErrorSink
  /** Context keys permitted to leave the browser. Everything else is dropped. */
  readonly allowedContextKeys?: readonly string[]
  /** Default 50. */
  readonly maxPerSession?: number
  /** Injected so tests are deterministic. Defaults to `Date.now`. */
  readonly now?: () => number
}

/** What an application holds and what `'sentra:errors'` provides. */
export interface ErrorReporter {
  report(
    error: unknown,
    context?: Readonly<Record<string, unknown>>,
    kind?: ErrorKind,
    csp?: { readonly directive: string; readonly blockedUri: string },
  ): void
  readonly count: number
}

/** Extracts a message and stack from anything a `throw` can produce. */
function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, stack: error.stack }
  return { message: String(error) }
}

/**
 * Creates a reporter.
 *
 * An error reporter is the one component whose own failure can amplify without
 * bound, so it carries four guards: a throwing sink is swallowed, identical
 * reports are deduplicated, `maxPerSession` ends reporting rather than degrading
 * it, and an error raised inside `report` is dropped rather than reported.
 */
export function createErrorReporter(options: CreateErrorReporterOptions): ErrorReporter {
  const maxPerSession = options.maxPerSession ?? 50
  const now = options.now ?? (() => Date.now())
  const allowed = new Set(options.allowedContextKeys ?? [])
  const seen = new Set<string>()
  let count = 0
  let reporting = false

  /** Keeps only allowlisted keys carrying primitive values. */
  function filterContext(
    context?: Readonly<Record<string, unknown>>,
  ): Record<string, string | number | boolean> {
    const filtered: Record<string, string | number | boolean> = {}
    if (!context) return filtered
    for (const [key, value] of Object.entries(context)) {
      if (!allowed.has(key)) continue
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        filtered[key] = typeof value === 'string' ? redact(value) : value
      }
    }
    return filtered
  }

  return {
    get count() {
      return count
    },

    report(error, context, kind = 'manual', csp) {
      /* Re-entrancy guard: an error raised inside the sink must not loop. */
      if (reporting) return
      if (count >= maxPerSession) return

      const { message, stack } = describe(error)
      const safeMessage = redact(message)
      const safeStack = stack ? redact(stack) : undefined
      const fingerprint = fingerprintOf(kind, safeMessage, safeStack)
      if (seen.has(fingerprint)) return
      seen.add(fingerprint)

      const report: ErrorReport = {
        kind,
        message: safeMessage,
        stack: safeStack,
        url: sanitizeUrl(globalThis.location?.href ?? ''),
        timestamp: now(),
        fingerprint,
        context: filterContext(context),
        csp: csp
          ? { directive: csp.directive, blockedUri: sanitizeUrl(csp.blockedUri) }
          : undefined,
      }

      reporting = true
      try {
        options.sink.report(report)
        count += 1
      } catch {
        /* A sink that throws must never take the application down. */
      } finally {
        reporting = false
      }
    },
  }
}
