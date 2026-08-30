import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORKER_FILE, appsStartingMockWorker, missingWorkerFiles } from './msw-worker.mjs'

/**
 * Builds a throwaway workspace tree, mirroring `workspace.test.mjs`'s fixture.
 *
 * @param {Record<string, unknown>} members - Path under the root mapped to its package.json contents.
 * @returns {Promise<string>} The root directory.
 */
async function workspaceFixture(members) {
  const root = await mkdtemp(join(tmpdir(), 'sentra-msw-ws-'))
  await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n  - 'apps/*'\n")
  for (const [dir, pkg] of Object.entries(members)) {
    await mkdir(join(root, dir), { recursive: true })
    await writeFile(join(root, dir, 'package.json'), JSON.stringify(pkg))
  }
  return root
}

/**
 * Writes a source file under a member's `src/`, creating parent directories.
 *
 * @param {string} root - Workspace root.
 * @param {string} path - Path relative to the root.
 * @param {string} contents - File contents.
 * @returns {Promise<void>}
 */
async function writeSource(root, path, contents) {
  const full = join(root, path)
  await mkdir(join(full, '..'), { recursive: true })
  await writeFile(full, contents)
}

describe('appsStartingMockWorker', () => {
  it('selects an app whose source imports msw/browser', async () => {
    const root = await workspaceFixture({
      'apps/console': { name: '@sentra/console', sentra: { role: 'reference' } },
      'apps/blank': { name: '@sentra/blank', sentra: { role: 'platform' } },
    })
    await writeSource(
      root,
      'apps/console/src/mocks/browser.ts',
      "import { setupWorker } from 'msw/browser'\n",
    )
    await writeSource(root, 'apps/blank/src/main.ts', 'export const x = 1\n')

    expect(await appsStartingMockWorker(root)).toEqual(['apps/console'])
  })

  it('ignores a prose mention that is not an import', async () => {
    // The shape `packages/sdk-commerce/src/mocks/handlers.ts` actually has: the
    // specifier appears inside a comment. An app that only talks about the
    // worker does not register one and must not be required to ship the file.
    const root = await workspaceFixture({
      'apps/talker': { name: '@sentra/talker', sentra: { role: 'platform' } },
    })
    await writeSource(
      root,
      'apps/talker/src/notes.ts',
      '/** Runs under `msw/browser`, no Buffer. */\n',
    )

    expect(await appsStartingMockWorker(root)).toEqual([])
  })

  it('ignores packages, which are libraries and serve no public directory', async () => {
    const root = await workspaceFixture({
      'packages/sdk-ops': { name: '@sentra/sdk-ops', sentra: { role: 'platform' } },
    })
    await writeSource(
      root,
      'packages/sdk-ops/src/mocks/browser.ts',
      "import { setupWorker } from 'msw/browser'\n",
    )

    expect(await appsStartingMockWorker(root)).toEqual([])
  })
})

describe('missingWorkerFiles', () => {
  it('reports an app that imports the worker but ships no worker file', async () => {
    const root = await workspaceFixture({
      'apps/console': { name: '@sentra/console', sentra: { role: 'reference' } },
    })
    await writeSource(
      root,
      'apps/console/src/mocks/browser.ts',
      "import { setupWorker } from 'msw/browser'\n",
    )

    const failures = await missingWorkerFiles(root, await appsStartingMockWorker(root))
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('apps/console')
    expect(failures[0]).toContain(WORKER_FILE)
  })

  it('passes an app that ships one', async () => {
    const root = await workspaceFixture({
      'apps/console': { name: '@sentra/console', sentra: { role: 'reference' } },
    })
    await writeSource(
      root,
      'apps/console/src/mocks/browser.ts',
      "import { setupWorker } from 'msw/browser'\n",
    )
    await writeSource(root, `apps/console/${WORKER_FILE}`, '/* worker */\n')

    expect(await missingWorkerFiles(root, await appsStartingMockWorker(root))).toEqual([])
  })

  it('is silent about a reference app absent from the workspace, as on a stripped tree', async () => {
    const root = await workspaceFixture({
      'apps/shell': { name: '@sentra/shell', sentra: { role: 'platform' } },
    })
    await writeSource(
      root,
      'apps/shell/src/mocks/browser.ts',
      "import { setupWorker } from 'msw/browser'\n",
    )
    await writeSource(root, `apps/shell/${WORKER_FILE}`, '/* worker */\n')

    expect(await appsStartingMockWorker(root)).toEqual(['apps/shell'])
    expect(await missingWorkerFiles(root, await appsStartingMockWorker(root))).toEqual([])
  })
})

describe('this workspace', () => {
  it('ships a worker file for every app that starts one', async () => {
    const root = join(import.meta.dirname, '..')
    const apps = await appsStartingMockWorker(root)

    /* Without this line the assertion below would pass on a tree where the
       derivation broke and found nothing — the empty-set vacuity this
       repository treats as a defect rather than a green check. Zero is never
       legitimate here: `apps/shell` is platform-owned, so it survives
       `strip-reference.mjs` and starts a worker on the stripped tree too. */
    expect(apps.length).toBeGreaterThan(0)
    expect(await missingWorkerFiles(root, apps)).toEqual([])
  })
})
