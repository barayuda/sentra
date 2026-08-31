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
    const error = new Error('boom')
    createErrorReporter({ sink, now: () => 1000 }).report(error)
    expect(sink.reports[0]?.message).toBe('boom')
    expect(sink.reports[0]?.timestamp).toBe(1000)
    /*
     * I4: `error.stack` was in scope here already (every `Error` gets one
     * from the engine), but nothing asserted the report actually carried it —
     * a bug that dropped or corrupted `stack` somewhere in the pipeline would
     * have passed this test regardless. `.stack` is engine-generated prose,
     * not a fixed literal, so exact equality with `error.stack` is too
     * brittle to assert (`redact()` may also alter it).
     *
     * Containment of the message alone is too weak in the other direction:
     * a V8 stack *begins with* `Error: boom`, so `toContain('boom')` also
     * passes when `describe()` copies `message` into `stack` — the exact bug
     * an assertion on `stack` exists to catch. Verified: mutating
     * `reporter.ts:34`'s `stack: error.stack` to `stack: error.message` left
     * all 12 tests in this file green. So assert both halves — that the stack
     * belongs to *this* error, and that it is a stack at all. Only the frame
     * pattern is unsatisfiable by a message.
     *
     * The mutation was not invisible to the package as a whole: it also turns
     * `report.test.ts`'s `fingerprintOf` case red, because the fingerprint is
     * derived from the stack. That is incidental coverage of a different unit,
     * not this test doing its job — but it means the gap was a weak assertion
     * here rather than a bug that could have shipped unnoticed.
     */
    expect(sink.reports[0]?.stack).toContain('boom')
    expect(sink.reports[0]?.stack).toMatch(/\n\s+at /)
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
    /* I4: count must increment only after a non-throwing `sink.report()` —
       a regression that incremented regardless of sink outcome would have
       passed this test with no assertion on `count` at all. */
    expect(reporter.count).toBe(0)
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
