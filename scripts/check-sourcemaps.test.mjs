import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appsRequiringSourcemaps, checkSourcemaps } from './check-sourcemaps.mjs'

/**
 * Builds a throwaway workspace tree, mirroring `workspace.test.mjs`'s fixture.
 *
 * @param {Record<string, unknown>} members - Path under the root mapped to its package.json contents.
 * @returns {Promise<string>} The root directory.
 */
async function workspaceFixture(members) {
  const root = await mkdtemp(join(tmpdir(), 'sentra-sourcemaps-ws-'))
  await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n  - 'apps/*'\n")
  for (const [dir, pkg] of Object.entries(members)) {
    await mkdir(join(root, dir), { recursive: true })
    await writeFile(join(root, dir, 'package.json'), JSON.stringify(pkg))
  }
  return root
}

/**
 * Writes a built app directory with a JS asset and, optionally, its sourcemap.
 *
 * @param {string} appDir - App directory to populate.
 * @param {boolean} withMap - Whether to also write the matching `.js.map`.
 * @returns {Promise<void>}
 */
async function writeBuiltApp(appDir, withMap) {
  await mkdir(join(appDir, 'dist/assets'), { recursive: true })
  await writeFile(join(appDir, 'dist/assets/index-abc123.js'), 'console.log(1)')
  if (withMap) await writeFile(join(appDir, 'dist/assets/index-abc123.js.map'), '{}')
}

describe('appsRequiringSourcemaps', () => {
  it('selects workspace members under apps/, ignoring packages/', async () => {
    const root = await workspaceFixture({
      'packages/ui': { name: '@sentra/ui', sentra: { role: 'platform' } },
      'apps/shell': { name: '@sentra/shell', sentra: { role: 'platform' } },
    })
    expect(await appsRequiringSourcemaps(root)).toEqual(['apps/shell'])
  })

  it('is silent about a reference app absent from the workspace, as on a stripped tree', async () => {
    // apps/storefront and apps/console simply are not on disk here -- the
    // same shape a stripped tree has once strip-reference.mjs deletes them.
    const root = await workspaceFixture({
      'apps/shell': { name: '@sentra/shell', sentra: { role: 'platform' } },
    })
    expect(await appsRequiringSourcemaps(root)).toEqual(['apps/shell'])
  })
})

describe('checkSourcemaps', () => {
  it('passes an app whose dist contains a .js.map file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-sourcemaps-'))
    const app = join(root, 'apps/shell')
    await writeBuiltApp(app, true)
    expect(await checkSourcemaps([app])).toEqual([])
  })

  it('fails an app whose dist has a build but no .js.map file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-sourcemaps-'))
    const app = join(root, 'apps/shell')
    await writeBuiltApp(app, false)
    const failures = await checkSourcemaps([app])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('contains no .js.map files')
  })

  it('fails an app that is in the workspace but has no dist at all', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sentra-sourcemaps-'))
    const app = join(root, 'apps/shell')
    await mkdir(app, { recursive: true })
    const failures = await checkSourcemaps([app])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('does not exist — run the build first')
  })
})

describe('the stripped-tree case end to end', () => {
  it('passes without complaining about reference apps absent from the workspace', async () => {
    const root = await workspaceFixture({
      'apps/shell': { name: '@sentra/shell', sentra: { role: 'platform' } },
    })
    await writeBuiltApp(join(root, 'apps/shell'), true)

    const apps = await appsRequiringSourcemaps(root)
    const failures = await checkSourcemaps(apps.map((dir) => join(root, dir)))

    /* Assert the reference apps are absent from `apps`, not from `failures`.
       An assertion that `failures` mentions no reference app holds identically
       whether or not the fix works, because the line above already requires
       `failures` to be empty and an empty list mentions nothing. `apps` is the
       value the fix actually changes, so it is the one worth asserting on. */
    expect(apps).toEqual(['apps/shell'])
    expect(failures).toEqual([])
  })
})
