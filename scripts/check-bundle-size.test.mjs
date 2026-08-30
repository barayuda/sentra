import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { classify, evaluate, gzippedSize, matchBudget } from './check-bundle-size.mjs'

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
