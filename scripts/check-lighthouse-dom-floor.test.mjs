import { describe, expect, it } from 'vitest'
import { checkDomFloors } from './check-lighthouse-dom-floor.mjs'

describe('checkDomFloors', () => {
  const floors = {
    'http://127.0.0.1:4173/': 100,
    'http://127.0.0.1:4173/products/sentra-piece-2': 10,
  }

  it('passes when every floored URL is at or above its floor', () => {
    const reports = [
      { requestedUrl: 'http://127.0.0.1:4173/', numericValue: 183 },
      { requestedUrl: 'http://127.0.0.1:4173/products/sentra-piece-2', numericValue: 22 },
    ]
    expect(checkDomFloors(reports, floors)).toEqual([])
  })

  it('fails a report that falls under its floor, by name', () => {
    const reports = [
      { requestedUrl: 'http://127.0.0.1:4173/', numericValue: 9 },
      { requestedUrl: 'http://127.0.0.1:4173/products/sentra-piece-2', numericValue: 22 },
    ]
    const failures = checkDomFloors(reports, floors)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('http://127.0.0.1:4173/')
    expect(failures[0]).toContain('9 elements')
  })

  it('checks every run of a URL, not just one', () => {
    const reports = [
      { requestedUrl: 'http://127.0.0.1:4173/', numericValue: 183 },
      { requestedUrl: 'http://127.0.0.1:4173/', numericValue: 9 },
      { requestedUrl: 'http://127.0.0.1:4173/', numericValue: 180 },
      { requestedUrl: 'http://127.0.0.1:4173/products/sentra-piece-2', numericValue: 22 },
    ]
    expect(checkDomFloors(reports, floors)).toHaveLength(1)
  })

  it('fails when a floored URL matched no report at all', () => {
    const reports = [{ requestedUrl: 'http://127.0.0.1:4173/', numericValue: 183 }]
    const failures = checkDomFloors(reports, floors)
    expect(failures).toEqual([
      'floor for http://127.0.0.1:4173/products/sentra-piece-2 matched no collected report',
    ])
  })

  it('ignores reports for URLs with no configured floor', () => {
    const reports = [{ requestedUrl: 'http://127.0.0.1:9999/unrelated', numericValue: 1 }]
    expect(checkDomFloors(reports, {})).toEqual([])
  })

  it('is the guard that would have caught the wrong-page defect this task found', () => {
    /* The exact shape of the coordinator's audit: three pages that passed
       every maxNumericValue budget while being the wrong page, distinguished
       only by DOM size. A shell RemoteUnavailable panel (30 elements) and a
       storefront router-miss (9 elements) both read as "cheap", not "broken",
       to every assertion this repo could previously express. */
    const floors2 = { 'http://127.0.0.1:4175/': 150 }
    const reports = [{ requestedUrl: 'http://127.0.0.1:4175/', numericValue: 30 }]
    const failures = checkDomFloors(reports, floors2)
    expect(failures).toEqual([
      'http://127.0.0.1:4175/: dom-size is 30 elements, under its floor of 150 — this measured a different (likely broken) page, not a smaller one',
    ])
  })
})
