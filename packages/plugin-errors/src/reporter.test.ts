import { describe, expect, it } from 'vitest'
import { createErrorReporter } from './reporter.ts'
import type { ErrorReport, ErrorSink } from './report.ts'

function collectingSink(): ErrorSink & { reports: ErrorReport[] } {
  const reports: ErrorReport[] = []
  return { reports, report: (report) => reports.push(report) }
}

describe('createErrorReporter', () => {
  it('reports an Error with its message and stack', () => {
    const sink = collectingSink()
    createErrorReporter({ sink, now: () => 1000 }).report(new Error('boom'))
    expect(sink.reports[0]?.message).toBe('boom')
    expect(sink.reports[0]?.timestamp).toBe(1000)
  })

  it('redacts the message', () => {
    const sink = collectingSink()
    createErrorReporter({ sink }).report(new Error('failed for a@b.com'))
    expect(sink.reports[0]?.message).toBe('failed for [redacted:email]')
  })

  it('coerces a non-Error throw to a string', () => {
    const sink = collectingSink()
    createErrorReporter({ sink }).report('plain string')
    expect(sink.reports[0]?.message).toBe('plain string')
  })

  it('keeps only allowlisted context keys', () => {
    const sink = collectingSink()
    const reporter = createErrorReporter({ sink, allowedContextKeys: ['route'] })
    reporter.report(new Error('boom'), { route: '/cart', email: 'a@b.com' })
    expect(sink.reports[0]?.context).toEqual({ route: '/cart' })
  })

  it('drops context values of unsupported types', () => {
    const sink = collectingSink()
    const reporter = createErrorReporter({ sink, allowedContextKeys: ['payload'] })
    reporter.report(new Error('boom'), { payload: { nested: true } })
    expect(sink.reports[0]?.context).toEqual({})
  })

  it('drops every context key when none are allowlisted', () => {
    const sink = collectingSink()
    createErrorReporter({ sink }).report(new Error('boom'), { route: '/cart' })
    expect(sink.reports[0]?.context).toEqual({})
  })

  it('redacts the value of an allowlisted string context key', () => {
    const sink = collectingSink()
    const reporter = createErrorReporter({ sink, allowedContextKeys: ['route'] })
    reporter.report(new Error('boom'), { route: 'contacted a@b.com about /cart' })
    expect(sink.reports[0]?.context).toEqual({ route: 'contacted [redacted:email] about /cart' })
  })

  /*
   * Non-strings are never passed to `redact` — for these the allowlist alone
   * is the structural guarantee, since `redact` is best-effort text scrubbing
   * and was never meant to be the load-bearing protection for a number.
   */
  it('passes an allowlisted numeric value through unchanged (allowlist, not redact, bounds this)', () => {
    const sink = collectingSink()
    const reporter = createErrorReporter({ sink, allowedContextKeys: ['cardNumber'] })
    reporter.report(new Error('boom'), { cardNumber: 4111111111111111 })
    expect(sink.reports[0]?.context).toEqual({ cardNumber: 4111111111111111 })
  })

  it('deduplicates identical errors', () => {
    const sink = collectingSink()
    const reporter = createErrorReporter({ sink })
    const error = new Error('boom')
    reporter.report(error)
    reporter.report(error)
    expect(sink.reports).toHaveLength(1)
  })

  it('stops at maxPerSession', () => {
    const sink = collectingSink()
    const reporter = createErrorReporter({ sink, maxPerSession: 2 })
    for (let i = 0; i < 5; i += 1) reporter.report(new Error(`boom ${i}`))
    expect(sink.reports).toHaveLength(2)
    expect(reporter.count).toBe(2)
  })

  it('survives a sink that throws', () => {
    const reporter = createErrorReporter({
      sink: {
        report() {
          throw new Error('sink exploded')
        },
      },
    })
    expect(() => reporter.report(new Error('boom'))).not.toThrow()
  })

  it('does not report an error raised inside the sink', () => {
    const seen: string[] = []
    const reporter: { current?: ReturnType<typeof createErrorReporter> } = {}
    reporter.current = createErrorReporter({
      sink: {
        report(report) {
          seen.push(report.message)
          reporter.current?.report(new Error('secondary'))
        },
      },
    })
    reporter.current.report(new Error('primary'))
    expect(seen).toEqual(['primary'])
  })
})
