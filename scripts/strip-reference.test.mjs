import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pruneManifest, stripReference } from './strip-reference.mjs'

describe('pruneManifest', () => {
  it('drops entries whose name is a reference member', () => {
    const entries = [
      { name: 'storefront', entry: 'http://x/e.js', basePath: '/shop' },
      { name: 'billing', entry: 'http://y/e.js', basePath: '/billing' },
    ]
    expect(pruneManifest(entries, new Set(['storefront']))).toEqual([entries[1]])
  })

  it('returns an empty array when every entry is a reference member', () => {
    const entries = [{ name: 'console', entry: 'http://x/e.js', basePath: '/ops' }]
    expect(pruneManifest(entries, new Set(['console']))).toEqual([])
  })

  it('leaves the array untouched when nothing matches', () => {
    const entries = [{ name: 'billing', entry: 'http://y/e.js', basePath: '/billing' }]
    expect(pruneManifest(entries, new Set(['storefront']))).toEqual(entries)
  })
})

describe('stripReference', () => {
  it('removes reference directories and prunes the manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-strip-'))
    await mkdir(join(root, 'packages/ui'), { recursive: true })
    await writeFile(
      join(root, 'packages/ui/package.json'),
      JSON.stringify({ name: '@sentra/ui', sentra: { role: 'platform' } }),
    )
    await mkdir(join(root, 'apps/shell/public'), { recursive: true })
    await writeFile(
      join(root, 'apps/shell/package.json'),
      JSON.stringify({ name: '@sentra/shell', sentra: { role: 'platform' } }),
    )
    await writeFile(
      join(root, 'apps/shell/public/remotes.json'),
      JSON.stringify([{ name: 'storefront', entry: 'http://x/e.js', basePath: '/shop' }]),
    )
    await mkdir(join(root, 'apps/storefront'), { recursive: true })
    await writeFile(
      join(root, 'apps/storefront/package.json'),
      JSON.stringify({ name: '@sentra/storefront', sentra: { role: 'reference' } }),
    )

    const result = await stripReference(root)

    expect(result.removed).toEqual(['apps/storefront'])
    await expect(readFile(join(root, 'apps/storefront/package.json'), 'utf8')).rejects.toThrow()
    expect(
      JSON.parse(await readFile(join(root, 'apps/shell/public/remotes.json'), 'utf8')),
    ).toEqual([])
    await expect(readFile(join(root, 'packages/ui/package.json'), 'utf8')).resolves.toContain(
      '@sentra/ui',
    )
  })

  it('removes the reference-owned documentation the root package.json declares', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-strip-docs-'))
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'sentra', sentra: { referenceDocs: ['docs/worked-example'] } }),
    )
    await mkdir(join(root, 'docs/worked-example'), { recursive: true })
    await writeFile(join(root, 'docs/worked-example/README.md'), '# cites deleted code\n')
    await mkdir(join(root, 'docs/adr'), { recursive: true })
    await writeFile(join(root, 'docs/adr/0001-x.md'), '# stays\n')

    const result = await stripReference(root)

    expect(result.removedDocs).toEqual(['docs/worked-example'])
    await expect(readFile(join(root, 'docs/worked-example/README.md'), 'utf8')).rejects.toThrow()
    await expect(readFile(join(root, 'docs/adr/0001-x.md'), 'utf8')).resolves.toContain('stays')
  })

  it('removes no documentation when the root package.json declares none', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-strip-nodocs-'))
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'sentra' }))
    await mkdir(join(root, 'docs/adr'), { recursive: true })
    await writeFile(join(root, 'docs/adr/0001-x.md'), '# stays\n')

    const result = await stripReference(root)

    expect(result.removedDocs).toEqual([])
    await expect(readFile(join(root, 'docs/adr/0001-x.md'), 'utf8')).resolves.toContain('stays')
  })

  it('removes no documentation when referenceDocs is a string, not an array', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-strip-baddocs-string-'))
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'sentra', sentra: { referenceDocs: 'docs/adr' } }),
    )
    await mkdir(join(root, 'docs/adr'), { recursive: true })
    await writeFile(join(root, 'docs/adr/0001-x.md'), '# stays\n')

    const result = await stripReference(root)

    expect(result.removedDocs).toEqual([])
    await expect(readFile(join(root, 'docs/adr/0001-x.md'), 'utf8')).resolves.toContain('stays')
  })

  it('removes no documentation when referenceDocs is an object, not an array', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-strip-baddocs-object-'))
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'sentra', sentra: { referenceDocs: { 0: 'docs/adr' } } }),
    )
    await mkdir(join(root, 'docs/adr'), { recursive: true })
    await writeFile(join(root, 'docs/adr/0001-x.md'), '# stays\n')

    const result = await stripReference(root)

    expect(result.removedDocs).toEqual([])
    await expect(readFile(join(root, 'docs/adr/0001-x.md'), 'utf8')).resolves.toContain('stays')
  })

  it('drops non-string entries from an otherwise valid referenceDocs array', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-strip-baddocs-mixed-'))
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'sentra',
        sentra: { referenceDocs: ['docs/worked-example', 42, null] },
      }),
    )
    await mkdir(join(root, 'docs/worked-example'), { recursive: true })
    await writeFile(join(root, 'docs/worked-example/README.md'), '# cites deleted code\n')

    const result = await stripReference(root)

    expect(result.removedDocs).toEqual(['docs/worked-example'])
  })
})
