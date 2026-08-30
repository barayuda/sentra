import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { readWorkspaceMembers } from './workspace.mjs'

/**
 * The import statement that makes an app register a Service Worker at runtime.
 *
 * Matched as the import rather than as the bare specifier on purpose: a comment
 * that mentions `msw/browser` in prose is not an app that starts a worker, and
 * `packages/sdk-commerce/src/mocks/handlers.ts` contains exactly that kind of
 * mention. Matching the import keeps the derived set equal to the set of apps
 * that actually need the file on disk.
 */
const WORKER_IMPORT = "from 'msw/browser'"

/** Path, relative to an app directory, that Vite serves the worker from. */
export const WORKER_FILE = 'public/mockServiceWorker.js'

/**
 * Lists every file under a directory tree, treating an absent tree as empty.
 *
 * @param {string} dir - Directory to walk.
 * @returns {Promise<string[]>} Absolute-or-relative paths, matching `dir`'s form.
 */
async function sourceFiles(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? sourceFiles(path) : [path]
    }),
  )
  return nested.flat()
}

/**
 * Finds the apps whose source starts an MSW Service Worker.
 *
 * Derived from the workspace, the same `sentra.role` source of truth
 * `check-sourcemaps.mjs` and `strip-reference.mjs` use, so a reference app the
 * strip deleted is simply absent from the result rather than reported missing.
 *
 * @param {string} rootDir - Workspace root.
 * @returns {Promise<string[]>} App directories, in workspace order.
 */
export async function appsStartingMockWorker(rootDir) {
  const members = await readWorkspaceMembers(rootDir)
  const apps = members.map((member) => member.dir).filter((dir) => dir.startsWith('apps/'))
  const starting = []
  for (const app of apps) {
    const files = await sourceFiles(join(rootDir, app, 'src'))
    const sources = files.filter((file) => file.endsWith('.ts') || file.endsWith('.vue'))
    const contents = await Promise.all(sources.map((file) => readFile(file, 'utf8')))
    if (contents.some((text) => text.includes(WORKER_IMPORT))) starting.push(app)
  }
  return starting
}

/**
 * Reports every app that starts a worker without shipping the worker script.
 *
 * `msw init` writes `public/mockServiceWorker.js`; nothing generates it at build
 * time, so the file is a committed artifact and can silently go missing for a
 * new app. When it does, `worker.start()` rejects — the browser refuses a
 * Service Worker served as `text/html` from the SPA fallback — and because
 * every app awaits that call before `createApp`, the whole standalone app
 * renders a blank page. That is what happened to `apps/console`: it declared
 * the `init-msw` script but the artifact was never committed.
 *
 * Nothing else in CI covers it. The federation e2e runs console code inside the
 * shell's page, where the shell's own worker already controls scope `/`;
 * Lighthouse runs against the shell; unit tests mock a layer below the worker.
 * So the console's standalone mocked mode had no check at all — an absence, in
 * the same family as the defects this milestone documents.
 *
 * @param {string} rootDir - Workspace root.
 * @param {string[]} apps - App directories, as returned by {@link appsStartingMockWorker}.
 * @returns {Promise<string[]>} One message per failing app; empty when all pass.
 */
export async function missingWorkerFiles(rootDir, apps) {
  const failures = []
  for (const app of apps) {
    try {
      await stat(join(rootDir, app, WORKER_FILE))
    } catch {
      failures.push(
        `${app} imports msw/browser but ships no ${WORKER_FILE} — run its init-msw script`,
      )
    }
  }
  return failures
}
