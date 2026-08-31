import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { ERRORS_INJECTION_KEY, NULL_REPORTER, errorsPlugin, useErrors } from './vue.ts'
import type { ErrorReport, ErrorSink } from './report.ts'
import type { ErrorReporter } from './reporter.ts'

const Probe = defineComponent({
  setup() {
    useErrors()
    return () => null
  },
})

describe('ERRORS_INJECTION_KEY', () => {
  it('is the plain string ADR 0005 requires', () => {
    expect(ERRORS_INJECTION_KEY as unknown as string).toBe('sentra:errors')
  })
})

describe('errorsPlugin', () => {
  it('provides a reporter and installs the capture sources', () => {
    const reports: ErrorReport[] = []
    const sink: ErrorSink = { report: (report) => reports.push(report) }
    render(Probe, { global: { plugins: [[errorsPlugin, { sink }]] } })

    const event = new Event('error') as Event & { error?: unknown }
    event.error = new Error('script broke')
    window.dispatchEvent(event)

    expect(reports[0]?.kind).toBe('window')
  })
})

describe('useErrors without an install', () => {
  it('returns NULL_REPORTER', () => {
    let reporter: ErrorReporter | undefined
    const CapturingProbe = defineComponent({
      setup() {
        reporter = useErrors()
        return () => null
      },
    })
    render(CapturingProbe)
    expect(reporter).toBe(NULL_REPORTER)
  })

  it('does not throw', () => {
    expect(() => render(Probe)).not.toThrow()
  })
})

describe('NULL_REPORTER', () => {
  it('report is a no-op', () => {
    expect(() => NULL_REPORTER.report(new Error('boom'))).not.toThrow()
  })

  it('count is 0', () => {
    expect(NULL_REPORTER.count).toBe(0)
  })
})
