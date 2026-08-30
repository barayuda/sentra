#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

/**
 * Compressed transfer size of a build artifact.
 *
 * Gzipped rather than raw, because raw bytes are not what a user waits for and
 * a budget nobody believes is a budget nobody defends.
 *
 * @param {Buffer} buffer - File contents.
 * @returns {number} Byte length after gzip.
 */
export function gzippedSize(buffer) {
  return gzipSync(buffer).length
}

/**
 * Converts a budget pattern to an anchored regular expression.
 *
 * `*` matches within one path segment only. A `*` that crossed `/` would let
 * `assets/index-*.js` claim `assets/vendor/index-x.js`, silently budgeting the
 * wrong file.
 *
 * @param {string} pattern - Glob with `*` wildcards.
 * @returns {RegExp} Anchored matcher.
 */
function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`)
}

/**
 * Finds the budget covering a file.
 *
 * @param {string} file - Path relative to the app's dist directory, `/`-separated.
 * @param {Record<string, number>} budgets - Pattern to max gzipped bytes.
 * @returns {{pattern: string, maxBytes: number} | null} The first matching budget, or null.
 */
export function matchBudget(file, budgets) {
  for (const [pattern, maxBytes] of Object.entries(budgets)) {
    if (patternToRegExp(pattern).test(file)) return { pattern, maxBytes }
  }
  return null
}

/**
 * Compares measurements against budgets.
 *
 * @param {Array<{file: string, bytes: number}>} measurements - Measured files.
 * @param {Record<string, number>} budgets - Pattern to max gzipped bytes.
 * @returns {{rows: Array<{file: string, bytes: number, budget: number | null}>, failures: string[]}}
 */
export function evaluate(measurements, budgets) {
  const rows = []
  const failures = []
  const matched = new Set()

  for (const measurement of measurements) {
    const budget = matchBudget(measurement.file, budgets)
    rows.push({
      file: measurement.file,
      bytes: measurement.bytes,
      budget: budget?.maxBytes ?? null,
    })
    if (budget === null) continue
    matched.add(budget.pattern)
    if (measurement.bytes > budget.maxBytes) {
      failures.push(
        `${measurement.file} is ${measurement.bytes} gzipped bytes, over its ${budget.maxBytes} budget by ${measurement.bytes - budget.maxBytes}`,
      )
    }
  }

  /* A budget that matched nothing is a budget that proves nothing. Renaming an
     entry chunk would otherwise turn this gate green while it measures no file
     at all. */
  for (const pattern of Object.keys(budgets)) {
    if (!matched.has(pattern)) failures.push(`budget "${pattern}" matched no file`)
  }

  return { rows, failures }
}

/**
 * Lists every file under a directory tree.
 *
 * @param {string} dir - Directory to walk.
 * @returns {Promise<string[]>} Absolute-ish paths joined from `dir`.
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
 * Measures one app's dist directory.
 *
 * @param {string} app - App directory, e.g. `apps/shell`.
 * @returns {Promise<Array<{file: string, bytes: number}>>} Measurements.
 */
async function measure(app) {
  const dist = join(app, 'dist')
  const files = await walk(dist)
  return Promise.all(
    files.map(async (path) => ({
      file: relative(dist, path).split(sep).join('/'),
      bytes: gzippedSize(await readFile(path)),
    })),
  )
}

/**
 * Classifies an app directory as present, unbuilt, or absent.
 *
 * Two of the three budgeted apps are reference-owned, and the strip path
 * deletes them outright — so a budgets file that survives a strip names
 * directories that are gone. "Gone" and "here but not yet built" must not
 * produce the same verdict: the first is an adopter's normal steady state,
 * the second is a broken CI run. Collapsing them would teach adopters to
 * ignore this gate's only failure message.
 *
 * @param {string} app - App directory, e.g. `apps/shell`.
 * @returns {Promise<'present' | 'unbuilt' | 'absent'>} Classification.
 */
export async function classify(app) {
  try {
    await stat(app)
  } catch {
    return 'absent'
  }
  try {
    await stat(join(app, 'dist'))
    return 'present'
  } catch {
    return 'unbuilt'
  }
}

/**
 * Fails when any app exceeds its committed bundle budget.
 *
 * Named risk area: performance regression. This is the gate that catches a
 * dependency accidentally pulled into the critical path by a barrel export —
 * the regression that actually happens, and the one nobody notices by eye.
 */
async function main() {
  const report = process.argv.includes('--report')
  const config = JSON.parse(await readFile('bundle-budgets.json', 'utf8'))
  const allFailures = []
  let measured = 0

  for (const [app, budgets] of Object.entries(config.apps)) {
    const presence = await classify(app)
    if (presence === 'absent') {
      console.log(`\n${app}\n  skipped — directory not present in this tree`)
      continue
    }
    if (presence === 'unbuilt') {
      allFailures.push(`${app}/dist does not exist — run the build first`)
      continue
    }
    measured += 1
    const measurements = await measure(app)
    const { rows, failures } = evaluate(measurements, budgets)
    console.log(`\n${app}`)
    for (const row of rows.sort((a, b) => b.bytes - a.bytes)) {
      const budget = row.budget === null ? '—' : String(row.budget)
      const delta =
        row.budget === null
          ? ''
          : ` (${row.bytes - row.budget >= 0 ? '+' : ''}${row.bytes - row.budget})`
      console.log(
        `  ${String(row.bytes).padStart(8)}  budget ${budget.padStart(8)}${delta}  ${row.file}`,
      )
    }
    if (!report) allFailures.push(...failures.map((failure) => `${app}: ${failure}`))
  }

  /* Skipping absent apps is only safe while something is still measured. A
     typo in every path, a strip that removed more than intended, or a run from
     the wrong working directory would otherwise leave a gate that passes
     because it examined nothing at all. */
  if (measured === 0) {
    allFailures.push('no app was measured — every budgeted directory was absent')
  }

  if (allFailures.length > 0) {
    console.error('')
    for (const failure of allFailures) console.error(`bundle-size check failed: ${failure}`)
    process.exit(1)
  }
  console.log(`\nbundle-size check ${report ? 'reported' : 'passed'}`)
}

if (process.argv[1]?.endsWith('check-bundle-size.mjs')) await main()
