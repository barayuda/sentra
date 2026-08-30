#!/usr/bin/env node
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { readWorkspaceMembers } from './workspace.mjs'

/**
 * Lists every file under a directory tree.
 *
 * @param {string} dir - Directory to walk.
 * @returns {Promise<string[]>} Paths relative to the process cwd.
 */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    }),
  )
  return files.flat()
}

/**
 * Finds the workspace members whose production bundles must ship sourcemaps.
 *
 * Derived from the workspace rather than hardcoded, using the same
 * `sentra.role` source of truth as `strip-reference.mjs` and `workspace.mjs`.
 * That derivation is what makes the two failure modes below distinguishable:
 * `apps/storefront` and `apps/console` are reference-owned, so once
 * `strip-reference.mjs` deletes them they are simply absent from this list —
 * silent and correct on a stripped tree, the same as `check-bundle-size.mjs`
 * treats an absent app. A hardcoded list cannot tell "deleted on purpose"
 * apart from "forgot to build," and reports the wrong one of the two.
 *
 * @param {string} rootDir - Workspace root.
 * @returns {Promise<string[]>} App directories under `apps/`, in workspace order.
 */
export async function appsRequiringSourcemaps(rootDir) {
  const members = await readWorkspaceMembers(rootDir)
  return members.map((member) => member.dir).filter((dir) => dir.startsWith('apps/'))
}

/**
 * Checks a set of already-resolved app directories for shipped sourcemaps.
 *
 * An app whose `dist` does not exist at all is genuinely unbuilt, not absent
 * — by the time an app directory reaches this function it is already known to
 * be a workspace member (see {@link appsRequiringSourcemaps}), so a missing
 * `dist` here must still fail, with the same message this gate has always
 * used. Absence at the workspace level and absence of a build are different
 * facts and must not be collapsed into one code path.
 *
 * @param {string[]} apps - App directories to check (relative or absolute).
 * @returns {Promise<string[]>} One failure message per app that fails; empty when all pass.
 */
export async function checkSourcemaps(apps) {
  const failures = []
  for (const app of apps) {
    const dist = join(app, 'dist')
    let files
    try {
      files = await walk(dist)
    } catch {
      failures.push(`${dist} does not exist — run the build first`)
      continue
    }
    const maps = files.filter((file) => file.endsWith('.js.map'))
    if (maps.length === 0) failures.push(`${dist} contains no .js.map files`)
  }
  return failures
}

/**
 * Fails when any app's build produced no sourcemaps.
 *
 * A production trace without sourcemaps names a minified symbol, which is the
 * same as naming nothing. This gate is cheap and catches the regression that
 * actually happens: someone adds a build flag, sourcemaps quietly stop being
 * emitted, and nobody notices until the first incident. Named risk area:
 * observability of production failures.
 */
async function main() {
  const apps = await appsRequiringSourcemaps(process.cwd())
  const failures = await checkSourcemaps(apps)

  if (failures.length > 0) {
    for (const failure of failures) console.error(`sourcemap check failed: ${failure}`)
    process.exit(1)
  }

  /* A loop over zero apps collects zero failures, so "passed for 0 apps" would
     report a control that ran when nothing was checked. `hash-remotes.mjs`
     settled this shape already and this follows it: say plainly that nothing
     was inspected. It does not exit non-zero, because a workspace can legally
     contain no apps; what it must not do is look like a passing check. */
  if (apps.length === 0) {
    console.log('sourcemap check inspected no apps: the workspace declares none under apps/.')
    return
  }
  console.log(`sourcemap check passed for ${apps.length} app${apps.length === 1 ? '' : 's'}`)
}

if (process.argv[1]?.endsWith('check-sourcemaps.mjs')) await main()
