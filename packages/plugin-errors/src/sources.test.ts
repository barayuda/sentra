import { createApp } from 'vue'
import { describe, expect, it } from 'vitest'
import { createErrorReporter } from './reporter.ts'
import { installErrorSources } from './sources.ts'
import type { ErrorReport, ErrorSink } from './report.ts'

function harness() {
  const reports: ErrorReport[] = []
  const sink: ErrorSink = { report: (report) => reports.push(report) }
  const reporter = createErrorReporter({ sink })
  const app = createApp({ render: () => null })
  const teardown = installErrorSources(app, reporter)
  return { reports, app, teardown }
}

describe('installErrorSources', () => {
  it('captures a Vue error through app.config.errorHandler', () => {
    const { reports, app } = harness()
    app.config.errorHandler?.(new Error('render blew up'), null, 'render')
    expect(reports[0]?.kind).toBe('vue')
    expect(reports[0]?.message).toBe('render blew up')
  })

  it('captures an unhandled rejection', () => {
    const { reports } = harness()
    const event = new Event('unhandledrejection') as Event & { reason?: unknown }
    event.reason = new Error('rejected')
    window.dispatchEvent(event)
    expect(reports[0]?.kind).toBe('unhandledrejection')
    expect(reports[0]?.message).toBe('rejected')
  })

  it('captures a window error', () => {
    const { reports } = harness()
    const event = new Event('error') as Event & { error?: unknown }
    event.error = new Error('script broke')
    window.dispatchEvent(event)
    expect(reports[0]?.kind).toBe('window')
    /* I4: only `kind` was asserted here — a bug that mangled the captured
       message (e.g. swapping `error` for `message` in `onError`) would have
       passed this test regardless. */
    expect(reports[0]?.message).toBe('script broke')
  })

  it('captures a CSP violation, which the meta-tag policy cannot report itself', () => {
    const { reports } = harness()
    const event = new Event('securitypolicyviolation') as Event & {
      violatedDirective?: string
      blockedURI?: string
    }
    event.violatedDirective = 'script-src'
    event.blockedURI = 'https://evil.example/x?token=abc'
    document.dispatchEvent(event)
    expect(reports[0]?.kind).toBe('csp')
    expect(reports[0]?.csp?.directive).toBe('script-src')
    expect(reports[0]?.csp?.blockedUri).toBe('https://evil.example/x')
  })

  /*
   * I4: these four teardown paths used to live in one `it` as sequential
   * assertions — if the first ever failed, vitest would stop that test right
   * there, and whether the other three teardown paths actually worked would
   * never be reported. Split so one failing path cannot mask the other
   * three; this is the highest-value item of the four gaps closed here, per
   * the review.
   */
  it('stops capturing a window error after teardown', () => {
    const { reports, teardown } = harness()
    teardown()

    const errorEvent = new Event('error') as Event & { error?: unknown }
    errorEvent.error = new Error('after teardown: window error')
    window.dispatchEvent(errorEvent)
    expect(reports).toHaveLength(0)
  })

  it('stops capturing an unhandled rejection after teardown', () => {
    const { reports, teardown } = harness()
    teardown()

    const rejectionEvent = new Event('unhandledrejection') as Event & { reason?: unknown }
    rejectionEvent.reason = new Error('after teardown: rejection')
    window.dispatchEvent(rejectionEvent)
    expect(reports).toHaveLength(0)
  })

  it('stops capturing a CSP violation after teardown', () => {
    const { reports, teardown } = harness()
    teardown()

    const violationEvent = new Event('securitypolicyviolation') as Event & {
      violatedDirective?: string
      blockedURI?: string
    }
    violationEvent.violatedDirective = 'script-src'
    violationEvent.blockedURI = 'https://evil.example/x'
    document.dispatchEvent(violationEvent)
    expect(reports).toHaveLength(0)
  })

  it('stops capturing a Vue error after teardown', () => {
    const { reports, app, teardown } = harness()
    teardown()

    app.config.errorHandler?.(new Error('after teardown: vue'), null, 'render')
    expect(reports).toHaveLength(0)
  })
})
