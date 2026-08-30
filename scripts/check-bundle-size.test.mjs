import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  classify,
  evaluate,
  gzippedSize,
  matchBudget,
  unknownBudgetKeyFailures,
} from './check-bundle-size.mjs'

describe('gzippedSize', () => {
  it('measures the compressed length, not the raw length', () => {
    const raw = Buffer.from('a'.repeat(10_000))
    expect(gzippedSize(raw)).toBe(gzipSync(raw).length)
    expect(gzippedSize(raw)).toBeLessThan(raw.length)
  })
})

describe('matchBudget', () => {
  const budgets = { 'assets/index-*.js': 100, 'assets/*.css': 50 }

  it('matches a hashed filename against its glob', () => {
    expect(matchBudget('assets/index-a1b2c3.js', budgets)).toEqual({
      pattern: 'assets/index-*.js',
      maxBytes: 100,
    })
  })

  it('does not let * cross a path separator', () => {
    expect(matchBudget('assets/nested/index-a1b2c3.js', budgets)).toBeNull()
  })

  it('returns null for a file no pattern covers', () => {
    expect(matchBudget('assets/logo.svg', budgets)).toBeNull()
  })

  it('does not treat a $-prefixed aggregate key as a glob pattern', () => {
    expect(matchBudget('$total:js', { '$total:js': 100 })).toBeNull()
  })

  it('skips a $-prefixed key and still matches a real pattern', () => {
    expect(
      matchBudget('assets/index-a1b2c3.js', { '$total:js': 999, 'assets/index-*.js': 100 }),
    ).toEqual({ pattern: 'assets/index-*.js', maxBytes: 100 })
  })
})

describe('evaluate', () => {
  const budgets = { 'assets/index-*.js': 100 }

  it('passes a file under budget', () => {
    const { failures } = evaluate([{ file: 'assets/index-x.js', bytes: 99 }], budgets)
    expect(failures).toEqual([])
  })

  it('passes a file exactly at budget', () => {
    const { failures } = evaluate([{ file: 'assets/index-x.js', bytes: 100 }], budgets)
    expect(failures).toEqual([])
  })

  it('fails a file one byte over budget', () => {
    const { failures } = evaluate([{ file: 'assets/index-x.js', bytes: 101 }], budgets)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('assets/index-x.js')
    expect(failures[0]).toContain('101')
  })

  it('fails when a budgeted pattern matched no file at all', () => {
    const { failures } = evaluate([{ file: 'assets/other.js', bytes: 10 }], budgets)
    expect(failures.some((f) => f.includes('matched no file'))).toBe(true)
  })

  it('reports unbudgeted files with a null budget rather than failing', () => {
    const { rows, failures } = evaluate(
      [
        { file: 'assets/index-x.js', bytes: 10 },
        { file: 'assets/logo.svg', bytes: 900 },
      ],
      budgets,
    )
    expect(failures).toEqual([])
    expect(rows.find((r) => r.file === 'assets/logo.svg').budget).toBeNull()
  })
})

describe('evaluate with $total aggregate budgets', () => {
  it('passes when the summed extension total is under budget', () => {
    const { failures } = evaluate(
      [
        { file: 'assets/a.js', bytes: 40 },
        { file: 'assets/b.js', bytes: 40 },
      ],
      { '$total:js': 100 },
    )
    expect(failures).toEqual([])
  })

  it('fails when the summed extension total is over budget, naming the aggregate', () => {
    const { failures } = evaluate(
      [
        { file: 'assets/a.js', bytes: 60 },
        { file: 'assets/b.js', bytes: 60 },
      ],
      { '$total:js': 100 },
    )
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('$total:js')
    expect(failures[0]).toContain('120')
  })

  it('fails a $total budget that aggregated zero files rather than passing on a zero sum', () => {
    const { failures } = evaluate([{ file: 'assets/logo.svg', bytes: 900 }], { '$total:js': 100 })
    expect(failures.some((f) => f.includes('$total:js') && f.includes('matched no file'))).toBe(
      true,
    )
  })

  it('does not double-report a $-prefixed key via the unmatched-pattern guard', () => {
    const { failures } = evaluate([{ file: 'assets/index-x.js', bytes: 10 }], {
      '$total:js': 100,
      'assets/index-*.js': 50,
    })
    expect(failures).toEqual([])
  })

  it('checks $total:js and $total:css independently', () => {
    const { failures } = evaluate(
      [
        { file: 'assets/a.js', bytes: 10 },
        { file: 'assets/a.css', bytes: 999 },
      ],
      { '$total:js': 100, '$total:css': 50 },
    )
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('$total:css')
  })
})

describe('unknownBudgetKeyFailures', () => {
  it('names an unrecognised $-prefixed key even while a real file is over its own budget', () => {
    // An oversized file is present and violates its own real pattern budget,
    // so this test would pass vacuously (failures.length > 0) if the unknown
    // key were merely being skipped rather than checked. The assertion below
    // looks for the specific unknown-key message, not just "some failure".
    const budgets = { 'assets/index-*.js': 10, '$total:jss': 1 }
    const { failures } = evaluate([{ file: 'assets/index-x.js', bytes: 999 }], budgets)
    expect(failures.some((f) => f.includes('assets/index-x.js'))).toBe(true)
    expect(
      failures.some(
        (f) =>
          f.includes('unknown reserved budget key') &&
          f.includes('$total:jss') &&
          f.includes('$total:js') &&
          f.includes('$total:css'),
      ),
    ).toBe(true)
  })

  it('fails on an unrecognised key without needing any measurement or directory at all', () => {
    // unknownBudgetKeyFailures takes only the budgets object -- no
    // measurements, no filesystem access -- which is what lets `main` call it
    // for an app that is absent or unbuilt, before either skip runs.
    const failures = unknownBudgetKeyFailures({ '$total:png': 100 })
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('$total:png')
    expect(failures[0]).toContain('permitted keys are $total:js, $total:css')
  })

  it('does not flag either recognised total key', () => {
    const failures = unknownBudgetKeyFailures({
      '$total:js': 100,
      '$total:css': 50,
      'assets/index-*.js': 10,
    })
    expect(failures).toEqual([])
  })
})

describe('classify', () => {
  it('reports an app that does not exist as absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-bundle-'))
    expect(await classify(join(root, 'apps/nope'))).toBe('absent')
  })

  it('reports an app that exists without a dist as unbuilt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-bundle-'))
    await mkdir(join(root, 'apps/shell'), { recursive: true })
    expect(await classify(join(root, 'apps/shell'))).toBe('unbuilt')
  })

  it('reports an app with a dist as present', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-bundle-'))
    await mkdir(join(root, 'apps/shell/dist'), { recursive: true })
    expect(await classify(join(root, 'apps/shell'))).toBe('present')
  })
})
