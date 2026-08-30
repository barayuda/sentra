import { describe, expect, it } from 'vitest'
import { parseRemoteManifest } from './manifest.ts'

const VALID = {
  name: 'console',
  entry: 'https://console.sentra.test/remoteEntry.js',
  basePath: '/ops',
}

describe('parseRemoteManifest', () => {
  it('accepts a well-formed manifest', () => {
    const result = parseRemoteManifest([VALID])
    if (!result.ok) throw new Error(`expected ok, got ${result.error.message}`)
    expect(result.value.entries).toEqual([VALID])
    expect(result.value.rejected).toEqual([])
  })

  it('fails hard when the document is not an array', () => {
    const result = parseRemoteManifest({ remotes: [VALID] })
    if (result.ok) throw new Error('expected a shape error')
    expect(result.error.kind).toBe('shape')
  })

  it('fails hard when the document is not JSON-shaped at all', () => {
    const result = parseRemoteManifest('<!doctype html>')
    if (result.ok) throw new Error('expected a shape error')
    expect(result.error.kind).toBe('shape')
  })

  it.each([
    ['a non-object entry', 'not-an-object'],
    ['a missing name', { ...VALID, name: undefined }],
    ['an empty name', { ...VALID, name: '   ' }],
    ['a relative entry URL', { ...VALID, entry: '/remoteEntry.js' }],
    ['a javascript: entry URL', { ...VALID, entry: 'javascript:alert(1)' }],
    ['a data: entry URL', { ...VALID, entry: 'data:text/javascript,alert(1)' }],
    ['a basePath without a leading slash', { ...VALID, basePath: 'ops' }],
    ['a root basePath', { ...VALID, basePath: '/' }],
    ['a trailing-slash basePath', { ...VALID, basePath: '/ops/' }],
    ['a wildcard basePath', { ...VALID, basePath: '/ops/*' }],
  ])('rejects %s while keeping the valid entries', (_label, bad) => {
    const result = parseRemoteManifest([VALID, bad])
    if (!result.ok) throw new Error('per-entry problems must not fail the document')
    expect(result.value.entries).toEqual([VALID])
    expect(result.value.rejected).toHaveLength(1)
    expect(result.value.rejected[0]?.index).toBe(1)
    expect(result.value.rejected[0]?.reason).not.toBe('')
  })

  it('rejects the later of two entries sharing a name', () => {
    const result = parseRemoteManifest([VALID, { ...VALID, basePath: '/ops2' }])
    if (!result.ok) throw new Error('expected ok')
    expect(result.value.entries).toEqual([VALID])
    expect(result.value.rejected[0]?.reason).toContain('name')
  })

  it('rejects the later of two entries sharing a basePath', () => {
    const result = parseRemoteManifest([VALID, { ...VALID, name: 'console2' }])
    if (!result.ok) throw new Error('expected ok')
    expect(result.value.entries).toEqual([VALID])
    expect(result.value.rejected[0]?.reason).toContain('basePath')
  })

  it('accepts an http entry so a local preview server works', () => {
    const local = { ...VALID, entry: 'http://127.0.0.1:4174/remoteEntry.js' }
    const result = parseRemoteManifest([local])
    if (!result.ok) throw new Error('expected ok')
    expect(result.value.entries).toEqual([local])
  })

  it('carries an integrity hash through when it is well formed', () => {
    const result = parseRemoteManifest([
      {
        name: 'a',
        entry: 'https://example.test/remoteEntry.js',
        basePath: '/a',
        integrity: `sha384-${'A'.repeat(64)}`,
      },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.entries[0]!.integrity).toBe(`sha384-${'A'.repeat(64)}`)
  })

  it('leaves integrity undefined when the field is absent', () => {
    const result = parseRemoteManifest([
      { name: 'a', entry: 'https://example.test/remoteEntry.js', basePath: '/a' },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.entries[0]!.integrity).toBeUndefined()
  })

  it('rejects an entry whose integrity is not a sha384 digest', () => {
    const result = parseRemoteManifest([
      {
        name: 'a',
        entry: 'https://example.test/remoteEntry.js',
        basePath: '/a',
        integrity: 'md5-abc',
      },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.entries).toHaveLength(0)
    expect(result.value.rejected[0]!.reason).toContain('integrity')
  })

  it('rejects an entry whose integrity is present but empty', () => {
    const result = parseRemoteManifest([
      { name: 'a', entry: 'https://example.test/remoteEntry.js', basePath: '/a', integrity: '' },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.entries).toHaveLength(0)
  })
})
