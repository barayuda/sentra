#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

/**
 * Checks every collected Lighthouse report's DOM size against a floor.
 *
 * `@lhci/cli` 0.15.1's assertion vocabulary is exactly `{minScore, maxLength,
 * maxNumericValue}` — there is no `minNumericValue`, so `lhci autorun` itself
 * cannot assert a *lower* bound on anything, `dom-size` included (see both
 * `lighthouserc*.json` `$comment`s). That gap is exactly how three URLs
 * measured a `RemoteUnavailable` panel, a blank router-miss, and a real page
 * indistinguishably: every `maxNumericValue` budget in this repo was
 * satisfied by all three, because a smaller, more-broken page can only ever
 * cost *less*. `dom-size`'s own `score`/`scoreDisplayMode` is
 * `metricSavings`, not pass/fail, so it never surfaces this either.
 *
 * This script is the floor `lhci` cannot express: a page that renders
 * correctly has a known, non-trivial minimum element count, and a run that
 * falls under it is a *different page* than the one this budget describes,
 * not a faster one. It runs after `lhci autorun` has written its reports,
 * reading them back rather than re-running Lighthouse itself.
 *
 * @param {Array<{requestedUrl: string, numericValue: number}>} reports - One entry per collected report.
 * @param {Record<string, number>} floors - Requested URL to minimum DOM element count.
 * @returns {string[]} One message per failure; empty when every floor is met.
 */
export function checkDomFloors(reports, floors) {
  const failures = []
  const matched = new Set()

  for (const report of reports) {
    const floor = floors[report.requestedUrl]
    if (floor === undefined) continue
    matched.add(report.requestedUrl)
    if (report.numericValue < floor) {
      failures.push(
        `${report.requestedUrl}: dom-size is ${report.numericValue} elements, under its floor of ${floor} — this measured a different (likely broken) page, not a smaller one`,
      )
    }
  }

  /* Same vacuity guard as scripts/check-bundle-size.mjs's `evaluate`: a floor
     that matched no report proves nothing — a renamed or dropped URL would
     otherwise leave this script silently passing while checking nothing. */
  for (const url of Object.keys(floors)) {
    if (!matched.has(url)) failures.push(`floor for ${url} matched no collected report`)
  }

  return failures
}

/**
 * Reads the reports `lhci` collected on *this* run, via `manifest.json`.
 *
 * Deliberately not a `readdir(outputDir)` over `*.report.json`: `@lhci/cli`
 * 0.15.1's filesystem target (`upload.js`) creates `outputDir` once and never
 * cleans it (`if (!fs.existsSync(targetDir)) fs.mkdirSync(...)`), so report
 * files from every past invocation accumulate there forever — a directory
 * listing cannot tell a fresh report from a leftover one from an unrelated
 * URL months ago. `manifest.json`, by contrast, is fully overwritten on every
 * run (`fs.writeFileSync(manifestPath, ...)`) with exactly the entries this
 * invocation produced, each naming its own `url` and `jsonPath`. That
 * distinction is load-bearing, not stylistic: a re-review falsified the old
 * `readdir` version by renaming a collected URL, leaving `domSizeFloor` keyed
 * to the old one, and producing zero fresh reports for the new URL — one
 * stale leftover report for the old URL was enough to satisfy the vacuity
 * guard below and pass, on a page that was never measured this run. A
 * missing or unreadable `manifest.json` is therefore a hard failure here,
 * not an empty report list: an empty list would sail past the same guard the
 * same way the stale file did.
 *
 * @param {string} outputDir - `ci.upload.outputDir` from the lighthouserc file.
 * @returns {Promise<Array<{requestedUrl: string, numericValue: number}>>} One entry per manifest-listed run.
 */
export async function readReports(outputDir) {
  const manifestPath = join(outputDir, 'manifest.json')
  let manifestRaw
  try {
    manifestRaw = await readFile(manifestPath, 'utf8')
  } catch (error) {
    throw new Error(
      `check-lighthouse-dom-floor: could not read ${manifestPath} (${error.code ?? error.message}) — refusing to fall back to scanning the directory, which cannot distinguish this run's reports from stale leftovers`,
    )
  }

  let manifest
  try {
    manifest = JSON.parse(manifestRaw)
  } catch (error) {
    throw new Error(`check-lighthouse-dom-floor: ${manifestPath} is not valid JSON (${error.message})`)
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error(`check-lighthouse-dom-floor: ${manifestPath} lists no runs — lhci collected nothing this invocation`)
  }

  return Promise.all(
    manifest.map(async (entry) => {
      const report = JSON.parse(await readFile(entry.jsonPath, 'utf8'))
      return { requestedUrl: entry.url, numericValue: report.audits['dom-size'].numericValue }
    }),
  )
}

/**
 * Fails when any collected report's DOM size is under its configured floor.
 *
 * Named risk area: none directly — this is a test-validity gate, not a
 * security or performance one. Its purpose is making sure the budgets above
 * it in the same lighthouserc file are ever measuring the page they claim to.
 */
async function main() {
  const configPath = process.argv[2]
  if (!configPath) {
    console.error('usage: node scripts/check-lighthouse-dom-floor.mjs <lighthouserc.json>')
    process.exit(1)
  }

  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const floors = config.domSizeFloor ?? {}
  if (Object.keys(floors).length === 0) {
    console.error(`check-lighthouse-dom-floor: ${configPath} declares no "domSizeFloor" — nothing to check`)
    process.exit(1)
  }

  const outputDir = config.ci?.upload?.outputDir ?? '.lighthouseci'
  let reports
  try {
    reports = await readReports(outputDir)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
  const failures = checkDomFloors(reports, floors)

  if (failures.length > 0) {
    for (const failure of failures) console.error(`dom-size floor check failed: ${failure}`)
    process.exit(1)
  }
  console.log(`dom-size floor check passed: ${Object.keys(floors).length} URL(s), ${reports.length} report(s)`)
}

if (process.argv[1]?.endsWith('check-lighthouse-dom-floor.mjs')) await main()
