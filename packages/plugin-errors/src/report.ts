/** Where a report came from. */
export type ErrorKind = 'vue' | 'window' | 'unhandledrejection' | 'csp' | 'manual'

/**
 * A report, as it leaves the browser.
 *
 * Closed and allowlist-only by design: there is no field that forwards
 * arbitrary data, and no collection path exists for `localStorage`, cookies,
 * form values, session tokens or user identifiers. The strongest guarantee here
 * is the one enforced by absent code, not by a filter.
 */
export interface ErrorReport {
  readonly kind: ErrorKind
  readonly message: string
  readonly stack?: string
  /** Origin and pathname only. Query and hash are discarded, never inspected. */
  readonly url: string
  readonly timestamp: number
  readonly fingerprint: string
  readonly context: Readonly<Record<string, string | number | boolean>>
  readonly csp?: { readonly directive: string; readonly blockedUri: string }
}

/** The seam. One method, so a vendor is roughly ten lines behind it. */
export interface ErrorSink {
  report(report: ErrorReport): void
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g
const LONG_DIGITS = /\d[\d\s-]{10,}\d/g
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi
/* Query strings in free-form text, for the reason `sanitizeUrl` gives below. */
const QUERY = /\?[^\s'")\]]*/g

/**
 * Reduces a URL to origin and pathname.
 *
 * The query is discarded wholesale rather than filtered, because a query string
 * is where emails and tokens actually live and an allowlist of safe parameter
 * names is a list nobody maintains.
 */
export function sanitizeUrl(href: string): string {
  try {
    const url = new URL(href)
    return `${url.origin}${url.pathname}`
  } catch {
    return 'unknown'
  }
}

/**
 * Scrubs identifier-shaped substrings from free-form text.
 *
 * Defence in depth, and best-effort by nature: pattern matching over prose
 * cannot be proven complete and must not be read as though it were. The
 * load-bearing guarantees are structural — the closed {@link ErrorReport} shape,
 * the absent collection paths, and the context allowlist.
 */
export function redact(text: string): string {
  return text
    .replace(QUERY, '')
    .replace(EMAIL, '[redacted:email]')
    .replace(BEARER, '[redacted:token]')
    .replace(LONG_DIGITS, '[redacted:number]')
}

/**
 * Composes a deduplication key from the kind, message and top stack frame.
 *
 * A plain composed string, not a hash: nothing here needs to be short or
 * opaque, and a hash would only add a function to get wrong.
 *
 * Callers must pass values that are already scrubbed. Because this key is
 * readable rather than hashed and travels to the sink on every report, an
 * unscrubbed argument here would ship verbatim what every other field on
 * {@link ErrorReport} takes care to remove.
 */
export function fingerprintOf(kind: ErrorKind, message: string, stack?: string): string {
  const topFrame =
    stack
      ?.split('\n')
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ''
  return `${kind}:${message}:${topFrame}`
}
