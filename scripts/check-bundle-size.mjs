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
 * Keys starting with `$` (e.g. `$total:js`) are aggregate budgets, not globs —
 * `evaluate` handles those separately, so they are skipped here rather than
 * compiled into a pattern that could never legitimately match a real file.
 *
 * @param {string} file - Path relative to the app's dist directory, `/`-separated.
 * @param {Record<string, number>} budgets - Pattern to max gzipped bytes.
 * @returns {{pattern: string, maxBytes: number} | null} The first matching budget, or null.
 */
export function matchBudget(file, budgets) {
  for (const [pattern, maxBytes] of Object.entries(budgets)) {
    if (pattern.startsWith('$')) continue
    if (patternToRegExp(pattern).test(file)) return { pattern, maxBytes }
  }
  return null
}

/**
 * Aggregate budget keys, and the file-extension each totals.
 *
 * A total is rename-proof where a per-file glob is not: it catches growth
 * inside chunks whose names are unstable module-federation/bundler virtual
 * modules that no glob can name reliably.
 */
const TOTAL_BUDGETS = { '$total:js': '.js', '$total:css': '.css' }

/**
 * Budget keys that are read as totals rather than as glob patterns.
 *
 * Reserving the `$` prefix stops `matchBudget` treating these as globs, but a
 * reservation alone leaves a gap: a key that is `$`-prefixed and *not* in this
 * set matches no glob, trips no guard, and is compared against nothing. It
 * reads as coverage in the budgets file while checking nothing at all. Any
 * unrecognised `$` key is therefore a hard failure — this set is derived from
 * `TOTAL_BUDGETS` above rather than listed again, so the two can never drift.
 */
const TOTAL_KEYS = new Set(Object.keys(TOTAL_BUDGETS))

/**
 * Flags `$`-prefixed budget keys that are not a recognised total.
 *
 * This must be checked independently of `evaluate`, and can never be folded
 * into the "matched no file" guards below: those guards only run once a real
 * measurement set exists, but a typo'd key is wrong in the budgets file
 * itself, not in the build, so it must be caught even for an app that is
 * absent or unbuilt (see the call in `main`, made before the classify skip).
 *
 * @param {Record<string, number>} budgets - An app's budget object.
 * @returns {string[]} One message per unrecognised `$`-prefixed key.
 */
export function unknownBudgetKeyFailures(budgets) {
  const permitted = [...TOTAL_KEYS].join(', ')
  return Object.keys(budgets)
    .filter((key) => key.startsWith('$') && !TOTAL_KEYS.has(key))
    .map((key) => `unknown reserved budget key "${key}" — permitted keys are ${permitted}`)
}

/**
 * Compares measurements against budgets.
 *
 * Two kinds of budget are checked: per-file glob patterns (unchanged from the
 * original gate) and per-app aggregate totals under `$total:js` / `$total:css`
 * (see `TOTAL_BUDGETS`). The totals exist because most of a bundle's weight
 * lives in bundler-generated chunk names no glob can name stably — a total is
 * rename-proof where a pattern is not. An unrecognised `$`-prefixed key (see
 * `unknownBudgetKeyFailures`) is reported here too, so an app that is present
 * gets the check without a caller having to remember to run it separately.
 *
 * @param {Array<{file: string, bytes: number}>} measurements - Measured files.
 * @param {Record<string, number>} budgets - Pattern (or `$total:*` key) to max gzipped bytes.
 * @returns {{rows: Array<{file: string, bytes: number, budget: number | null}>, failures: string[]}}
 */
export function evaluate(measurements, budgets) {
  const rows = []
  const failures = [...unknownBudgetKeyFailures(budgets)]
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
    if (pattern.startsWith('$')) continue
    if (!matched.has(pattern)) failures.push(`budget "${pattern}" matched no file`)
  }

  for (const [key, extension] of Object.entries(TOTAL_BUDGETS)) {
    if (!(key in budgets)) continue
    const contributing = measurements.filter((measurement) => measurement.file.endsWith(extension))

    /* Same vacuity guard as the per-pattern loop above, one level down: an
       aggregate over zero files is 0, and 0 is under any budget, so without
       this check a typo'd extension or an empty dist would read as coverage
       while measuring nothing. */
    if (contributing.length === 0) {
      failures.push(`budget "${key}" matched no file`)
      continue
    }

    const total = contributing.reduce((sum, measurement) => sum + measurement.bytes, 0)
    const maxBytes = budgets[key]
    if (total > maxBytes) {
      failures.push(
        `${key} is ${total} gzipped bytes, over its ${maxBytes} budget by ${total - maxBytes}`,
      )
    }
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
 * Source maps are excluded entirely, not merely left unbudgeted: they are
 * verified separately by `verify:sourcemaps`, and letting them into a `$total`
 * aggregate would silently inflate it with bytes nobody ships to a browser.
 *
 * @param {string} app - App directory, e.g. `apps/shell`.
 * @returns {Promise<Array<{file: string, bytes: number}>>} Measurements.
 */
async function measure(app) {
  const dist = join(app, 'dist')
  const files = (await walk(dist)).filter((path) => !path.endsWith('.map'))
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

    /* A typo'd reserved key is wrong in the budgets file, not in the build, so
       it must be caught whether or not this app was built or even exists —
       hence this runs before either skip below, not inside the `present`
       branch where `evaluate` otherwise catches it. */
    if (presence !== 'present') {
      allFailures.push(...unknownBudgetKeyFailures(budgets).map((failure) => `${app}: ${failure}`))
    }

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
    for (const [key, extension] of Object.entries(TOTAL_BUDGETS)) {
      if (!(key in budgets)) continue
      const total = rows
        .filter((row) => row.file.endsWith(extension))
        .reduce((sum, row) => sum + row.bytes, 0)
      console.log(
        `  ${String(total).padStart(8)}  budget ${String(budgets[key]).padStart(8)}  ${key}`,
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
