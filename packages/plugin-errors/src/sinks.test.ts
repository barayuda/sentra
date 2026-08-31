import { describe, expect, it, vi } from 'vitest'
import { beaconSink, consoleSink } from './sinks.ts'
import type { ErrorReport } from './report.ts'

const report: ErrorReport = {
  kind: 'manual',
  message: 'boom',
  url: 'https://shop.example/p',
  timestamp: 1000,
  fingerprint: 'manual:boom:',
  context: {},
}

describe('consoleSink', () => {
  it('writes the report to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    consoleSink().report(report)
    expect(spy).toHaveBeenCalledWith('[errors]', report)
    spy.mockRestore()
  })
})

describe('beaconSink', () => {
  it('posts a JSON blob to the given url', () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { ...navigator, sendBeacon })
    beaconSink('https://collector.example/errors').report(report)
    expect(sendBeacon).toHaveBeenCalledWith('https://collector.example/errors', expect.any(Blob))
    vi.unstubAllGlobals()
  })
})
