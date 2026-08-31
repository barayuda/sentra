import { describe, expect, it } from 'vitest'
import { createErrorReporter } from './reporter.ts'
import { fingerprintOf, redact, sanitizeUrl } from './report.ts'
import type { ErrorReport, ErrorSink } from './report.ts'

function collectingSink(): ErrorSink & { reports: ErrorReport[] } {
  const reports: ErrorReport[] = []
  return { reports, report: (report) => reports.push(report) }
}

describe('sanitizeUrl', () => {
  it('keeps origin and pathname', () => {
    expect(sanitizeUrl('https://shop.example/products/42')).toBe('https://shop.example/products/42')
  })

  it('discards the query, where emails and tokens live', () => {
    expect(sanitizeUrl('https://shop.example/p?email=a@b.com&token=abc')).toBe(
      'https://shop.example/p',
    )
  })

  it('discards the fragment', () => {
    expect(sanitizeUrl('https://shop.example/p#section')).toBe('https://shop.example/p')
  })

  it('returns "unknown" for an unparseable value', () => {
    expect(sanitizeUrl('not a url')).toBe('unknown')
  })
})

describe('redact', () => {
  it('removes an email address', () => {
    expect(redact('failed for person@example.com')).toBe('failed for [redacted:email]')
  })

  it('removes a long digit run', () => {
    expect(redact('card 4111111111111111 declined')).toBe('card [redacted:number] declined')
  })

  it('leaves a short number alone', () => {
    expect(redact('retry 3 times')).toBe('retry 3 times')
  })

  it('removes a bearer token', () => {
    expect(redact('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456')).toBe(
      'Authorization: [redacted:token]',
    )
  })

  it('strips query strings from free-form text', () => {
    expect(redact('at h (https://x.test/pay?token=abc123def456:1:2)')).not.toContain('token')
  })
})

describe('fingerprintOf', () => {
  it('is stable for the same error', () => {
    expect(fingerprintOf('vue', 'boom', 'at f (a.js:1)')).toBe(
      fingerprintOf('vue', 'boom', 'at f (a.js:1)'),
    )
  })

  it('differs when the top frame differs', () => {
    expect(fingerprintOf('vue', 'boom', 'at f (a.js:1)')).not.toBe(
      fingerprintOf('vue', 'boom', 'at g (b.js:2)'),
    )
  })

  it('ignores frames below the first', () => {
    expect(fingerprintOf('vue', 'boom', 'at f (a.js:1)\nat g (b.js:2)')).toBe(
      fingerprintOf('vue', 'boom', 'at f (a.js:1)\nat h (c.js:3)'),
    )
  })

  it('derives the fingerprint from scrubbed input', () => {
    const sink = collectingSink()
    createErrorReporter({ sink }).report(
      Object.assign(new Error('boom'), {
        stack: 'at h (https://x.test/pay?token=abc123def456:1:2)',
      }),
    )
    expect(sink.reports[0]?.fingerprint).not.toContain('token')
  })
})
