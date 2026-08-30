#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Severities this gate blocks on. */
const BLOCKING = new Set(['high', 'critical'])

/**
 * Reconciles reported advisories against the accepted list.
 *
 * Two independent failure sources, and the second is the point of the design.
 * An unreviewed advisory fails, obviously. But an *accepted* advisory whose
 * deadline has passed also fails, whether or not it is still reported — an
 * entry that outlives its expiry is a decision nobody revisited, and the build
 * is the only thing that reliably asks.
 *
 * @param {Array<{id: string, module: string, severity: string, title: string}>} advisories - Blocking advisories reported by the tool.
 * @param {Array<{id: string, module: string, reason: string, expires: string}>} allowlist - Accepted entries.
 * @param {Date} today - Reference date, injected so the tests are not time-dependent.
 * @returns {{failures: string[], accepted: string[]}} Problems, and the ids that were consciously accepted.
 */
export function reconcile(advisories, allowlist, today) {
  const failures = []
  const accepted = []

  /* An entry earns its place in `valid` by surviving this loop. Deriving the
     map from the same pass that reports the failures — rather than restating
     the three conditions in a second filter — means the two can never drift
     apart. A duplicated predicate here would be a live hazard: relax one copy
     and an entry that reports as rejected still silences its advisory. */
  const valid = new Map()

  for (const entry of allowlist) {
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      failures.push(`allowlist entry ${entry.id} (${entry.module}) has an empty reason`)
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? '')) {
      failures.push(
        `allowlist entry ${entry.id} (${entry.module}) has a malformed expires value "${entry.expires}" — use YYYY-MM-DD`,
      )
      continue
    }
    /* The expiry date itself is still valid: an entry expiring today is
       accepted today and fails tomorrow. Comparing against end-of-day UTC
       keeps that boundary unambiguous across timezones. */
    const deadline = new Date(`${entry.expires}T23:59:59Z`)
    if (deadline.getTime() < today.getTime()) {
      failures.push(
        `allowlist entry ${entry.id} (${entry.module}) expired on ${entry.expires} — upgrade, replace, or re-accept it with a new deadline`,
      )
      continue
    }
    valid.set(`${entry.id}::${entry.module}`, entry)
  }

  for (const advisory of advisories) {
    if (valid.has(`${advisory.id}::${advisory.module}`)) {
      accepted.push(advisory.id)
      continue
    }
    failures.push(
      `${advisory.severity} advisory ${advisory.id} in ${advisory.module}: ${advisory.title} — fix it, or add it to security/audit-allowlist.json with a reason and a deadline`,
    )
  }

  return { failures, accepted }
}

/**
 * Top-level keys that may hold the advisory list, in priority order.
 *
 * The audit tool's JSON shape carries no stability contract, so this list is
 * recorded from **observed** output — Step 3b requires running the command and
 * writing down which key actually appears — never assumed from another tool's
 * format. Observed on pnpm 10.34.5: `pnpm audit --json` emits a top-level
 * `advisories` object keyed by numeric advisory id.
 */
const ADVISORY_CONTAINERS = ['advisories', 'vulnerabilities']

/**
 * Normalises `pnpm audit --json` output into the shape {@link reconcile} takes.
 *
 * Returns a verdict rather than a bare array, because "no advisories" and "I
 * could not read this report" must never be the same value. They are the same
 * value in every naive parser, and the consequence is the worst failure a
 * security gate has: a changed output format silently turns the check into a
 * no-op that reports success. An empty **recognised** container is the one and
 * only case that legitimately yields zero.
 *
 * A container is recognised only if every entry in it carries a string
 * `severity`. That check exists because a summary object of counts — plausible
 * under a key like `vulnerabilities` — would otherwise parse as a container of
 * zero blocking advisories and pass.
 *
 * Named risk area: supply chain.
 *
 * @param {string} stdout - Raw JSON from the audit command.
 * @returns {{recognized: boolean, advisories: Array<{id: string, module: string, severity: string, title: string}>, reason?: string}} Parse verdict.
 */
export function parseAuditOutput(stdout) {
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return { recognized: false, advisories: [], reason: 'output was not JSON' }
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { recognized: false, advisories: [], reason: 'output was not a JSON object' }
  }

  const key = ADVISORY_CONTAINERS.find((candidate) => candidate in parsed)
  if (key === undefined) {
    return {
      recognized: false,
      advisories: [],
      reason: `no known advisory container in output — looked for ${ADVISORY_CONTAINERS.join(', ')}`,
    }
  }

  const raw = parsed[key]
  const entries = Array.isArray(raw) ? raw : Object.values(raw ?? {})
  const malformed = entries.filter(
    (entry) => entry === null || typeof entry !== 'object' || typeof entry.severity !== 'string',
  )
  if (malformed.length > 0) {
    return {
      recognized: false,
      advisories: [],
      reason: `${malformed.length} of ${entries.length} entries under "${key}" carry no string severity — the report format has changed`,
    }
  }

  return {
    recognized: true,
    advisories: entries
      .filter((advisory) => BLOCKING.has(advisory.severity))
      .map((advisory) => ({
        id: String(advisory.github_advisory_id ?? advisory.id ?? 'unknown'),
        module: String(advisory.module_name ?? advisory.name ?? 'unknown'),
        severity: advisory.severity,
        title: String(advisory.title ?? 'no title'),
      })),
  }
}

/**
 * Fails the build on an unreviewed or stale-accepted advisory.
 *
 * Named risk area: supply chain.
 */
async function main() {
  let stdout = ''
  try {
    ;({ stdout } = await run('pnpm', ['audit', '--audit-level=high', '--json'], {
      maxBuffer: 32 * 1024 * 1024,
    }))
  } catch (error) {
    /* `pnpm audit` exits non-zero when it finds anything, so a non-zero exit is
       the normal path, not an error. Its stdout still holds the report. */
    stdout = error.stdout ?? ''
    if (stdout === '') {
      console.error('audit check failed: pnpm audit produced no output')
      console.error(error.stderr ?? String(error))
      process.exit(1)
    }
  }

  const parseResult = parseAuditOutput(stdout)
  if (!parseResult.recognized) {
    console.error(`audit check failed: could not read the audit report — ${parseResult.reason}`)
    console.error('raw output follows, truncated to 4000 characters:')
    console.error(stdout.slice(0, 4000))
    process.exit(1)
  }
  const advisories = parseResult.advisories
  const config = JSON.parse(await readFile('security/audit-allowlist.json', 'utf8'))
  const { failures, accepted } = reconcile(advisories, config.accepted ?? [], new Date())

  for (const id of accepted) console.log(`audit: ${id} accepted per security/audit-allowlist.json`)

  if (failures.length > 0) {
    for (const failure of failures) console.error(`audit check failed: ${failure}`)
    process.exit(1)
  }
  console.log(
    `audit check passed: ${advisories.length} blocking advisories, ${accepted.length} accepted`,
  )
}

if (process.argv[1]?.endsWith('check-audit.mjs')) await main()
