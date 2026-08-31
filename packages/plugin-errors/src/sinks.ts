import type { ErrorReport, ErrorSink } from './report.ts'

/** Development sink: reports go to `console.error` and nowhere else. */
export function consoleSink(): ErrorSink {
  return {
    report(report) {
      console.error('[errors]', report)
    },
  }
}

/**
 * Production sink using `navigator.sendBeacon`, which survives page unloads
 * that would cancel a `fetch`. Payload is a JSON Blob of the report, mirroring
 * `beaconTransport` in `@sentra/plugin-analytics`.
 */
export function beaconSink(url: string): ErrorSink {
  return {
    report(report: ErrorReport) {
      const body = new Blob([JSON.stringify(report)], { type: 'application/json' })
      navigator.sendBeacon(url, body)
    },
  }
}
