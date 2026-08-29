#!/usr/bin/env node
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

/** Apps whose production bundles must ship sourcemaps. */
const APPS = ['apps/storefront', 'apps/console', 'apps/shell']

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
 * Fails when any app's build produced no sourcemaps.
 *
 * A production trace without sourcemaps names a minified symbol, which is the
 * same as naming nothing. This gate is cheap and catches the regression that
 * actually happens: someone adds a build flag, sourcemaps quietly stop being
 * emitted, and nobody notices until the first incident. Named risk area:
 * observability of production failures.
 */
async function main() {
  const failures = []
  for (const app of APPS) {
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

  if (failures.length > 0) {
    for (const failure of failures) console.error(`sourcemap check failed: ${failure}`)
    process.exit(1)
  }
  console.log(`sourcemap check passed for ${APPS.length} apps`)
}

await main()
