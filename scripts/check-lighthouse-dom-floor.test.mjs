import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkDomFloors, readReports } from './check-lighthouse-dom-floor.mjs'

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

describe('readReports', () => {
  /*
   * Regression for the re-review finding on fix round 2: a naive
   * `readdir(outputDir).filter(name => name.endsWith('.report.json'))`
   * resolves reports by scanning the whole directory, not by asking what
   * *this run* actually collected. `.lighthouseci/` accumulates
   * `*.report.json` files across every invocation forever (`@lhci/cli`
   * 0.15.1's `upload.js` creates the dir once and never cleans it), while
   * `manifest.json` is fully overwritten each run with only the entries
   * `lhci` just produced.
   *
   * This scenario mirrors the re-reviewer's exact reproduction: a stale
   * leftover report exists for a URL this run's manifest no longer
   * mentions (e.g. after a `ci.collect.url` rename), and `domSizeFloor` is
   * still keyed to that old URL. The floor's vacuity guard exists
   * precisely to catch "this URL was never actually measured" -- but a
   * directory listing lets the stale file impersonate a fresh measurement
   * and silently satisfies it.
   */
  it('resolves reports through manifest.json, not every *.report.json on disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lh-dom-floor-'))
    try {
      // A leftover from a long-past run, for a URL no longer in this run's
      // collect list. Named so it also sorts and globs like a real report.
      const staleReportPath = join(dir, '127_0_0_1--2020_01_01_00_00_00.report.json')
      await writeFile(
        staleReportPath,
        JSON.stringify({
          requestedUrl: 'http://127.0.0.1:4173/old-url',
          audits: { 'dom-size': { numericValue: 9 } },
        }),
      )

      // This run's manifest describes only the current URL, with its own report.
      const freshReportPath = join(dir, '127_0_0_1--fresh.report.json')
      await writeFile(
        freshReportPath,
        JSON.stringify({
          requestedUrl: 'http://127.0.0.1:4173/new-url',
          audits: { 'dom-size': { numericValue: 183 } },
        }),
      )
      await writeFile(
        join(dir, 'manifest.json'),
        JSON.stringify([
          {
            url: 'http://127.0.0.1:4173/new-url',
            jsonPath: freshReportPath,
            isRepresentativeRun: true,
          },
        ]),
      )

      // The floor is keyed to the old URL -- a config that was never updated
      // after the rename, or simply hasn't collected that page this run.
      const floors = { 'http://127.0.0.1:4173/old-url': 5 }
      const reports = await readReports(dir)
      const failures = checkDomFloors(reports, floors)

      // The old URL was never measured by this run -- the vacuity guard must
      // say so. Before the manifest fix, the stale file's numericValue (9)
      // cleared this floor (5) and the guard was satisfied by a leftover
      // instead of firing, so this assertion failed with `[]`.
      expect(failures).toEqual([
        'floor for http://127.0.0.1:4173/old-url matched no collected report',
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
