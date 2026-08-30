import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readWorkspaceMembers, roleProblems } from './workspace.mjs'

/**
 * Builds a throwaway workspace tree.
 *
 * @param {Record<string, unknown>} members - Path under the root mapped to its package.json contents.
 * @returns {Promise<string>} The root directory.
 */
async function fixture(members) {
  const root = await mkdtemp(join(tmpdir(), 'sentra-ws-'))
  await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n  - 'apps/*'\n")
  for (const [dir, pkg] of Object.entries(members)) {
    await mkdir(join(root, dir), { recursive: true })
    await writeFile(join(root, dir, 'package.json'), JSON.stringify(pkg))
  }
  return root
}

describe('readWorkspaceMembers', () => {
  it('reads the role from each member', async () => {
    const root = await fixture({
      'packages/ui': { name: '@sentra/ui', sentra: { role: 'platform' } },
      'apps/storefront': { name: '@sentra/storefront', sentra: { role: 'reference' } },
    })
    const members = await readWorkspaceMembers(root)
    expect(members.map((m) => [m.name, m.role]).sort()).toEqual([
      ['@sentra/storefront', 'reference'],
      ['@sentra/ui', 'platform'],
    ])
  })

  it('reports a null role when the field is absent', async () => {
    const root = await fixture({ 'packages/ui': { name: '@sentra/ui' } })
    const members = await readWorkspaceMembers(root)
    expect(members[0].role).toBeNull()
  })
})

describe('roleProblems', () => {
  it('is empty when every member declares a valid role', () => {
    expect(
      roleProblems([
        { dir: 'packages/ui', name: '@sentra/ui', role: 'platform' },
        { dir: 'apps/storefront', name: '@sentra/storefront', role: 'reference' },
      ]),
    ).toEqual([])
  })

  it('names a member with no role', () => {
    const problems = roleProblems([
      { dir: 'packages/x', name: '@sentra/x', role: null },
      { dir: 'packages/y', name: '@sentra/y', role: 'platform' },
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('@sentra/x')
  })

  it('names a member with an unrecognised role', () => {
    const problems = roleProblems([
      { dir: 'packages/x', name: '@sentra/x', role: 'demo' },
      { dir: 'packages/y', name: '@sentra/y', role: 'platform' },
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('demo')
  })

  it('fails when no member is platform', () => {
    const problems = roleProblems([
      { dir: 'apps/storefront', name: '@sentra/storefront', role: 'reference' },
    ])
    expect(problems.some((p) => p.includes('no platform'))).toBe(true)
  })
})
