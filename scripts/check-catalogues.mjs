#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'

/** The locale every group is checked against. */
const REFERENCE_LOCALE = 'en'
/** Directories scanned for `src/i18n/` catalogue groups. */
const ROOTS = ['packages', 'apps']
/** Matches `{name}` placeholders. */
const PLACEHOLDER = /\{(\w+)\}/g

/**
 * Collects the placeholder names a message uses, across every plural branch.
 *
 * @param {string | Record<string, string>} message - A catalogue value.
 * @returns {Set<string>} Placeholder names.
 */
export function placeholdersOf(message) {
  const names = new Set()
  const branches = typeof message === 'string' ? [message] : Object.values(message)
  for (const branch of branches) {
    for (const match of String(branch).matchAll(PLACEHOLDER)) names.add(match[1])
  }
  return names
}

/**
 * Checks one catalogue group against its reference locale.
 *
 * Key presence is largely redundant with the typechecker for TypeScript-typed
 * catalogues, and load-bearing for anything the typechecker does not see.
 * Placeholder parity is the rule that earns this gate its runtime: a translation
 * that drops a `{placeholder}` typechecks perfectly and is silently wrong.
 *
 * Values identical to the reference are deliberately NOT flagged. "Email" is
 * "Email" in Indonesian, and a gate people learn to ignore is worse than none.
 *
 * @param {string} name - Group name, for messages.
 * @param {Record<string, Record<string, unknown>>} catalogues - Locale to catalogue.
 * @returns {string[]} Human-readable problems; empty means pass.
 */
export function checkGroup(name, catalogues) {
  const problems = []
  const reference = catalogues[REFERENCE_LOCALE]
  if (!reference) {
    problems.push(`${name}: no ${REFERENCE_LOCALE}.json — every group needs a reference locale`)
    return problems
  }

  const others = Object.keys(catalogues).filter((locale) => locale !== REFERENCE_LOCALE)
  if (others.length === 0) {
    problems.push(
      `${name}: single-locale catalogue — ${REFERENCE_LOCALE}.json exists with no translation beside it`,
    )
    return problems
  }

  for (const [key, message] of Object.entries(reference)) {
    if (typeof message === 'object' && message !== null && !('other' in message)) {
      problems.push(`${name}: ${REFERENCE_LOCALE}.json "${key}" is plural with no "other" branch`)
    }
  }

  for (const locale of others) {
    const catalogue = catalogues[locale]
    for (const key of Object.keys(reference)) {
      if (!(key in catalogue)) {
        problems.push(`${name}: ${locale}.json is missing "${key}"`)
      }
    }
    for (const key of Object.keys(catalogue)) {
      if (!(key in reference)) {
        problems.push(`${name}: ${locale}.json has "${key}", absent from ${REFERENCE_LOCALE}.json`)
      }
    }
    for (const [key, message] of Object.entries(catalogue)) {
      if (!(key in reference)) continue
      if (typeof message === 'object' && message !== null && !('other' in message)) {
        problems.push(`${name}: ${locale}.json "${key}" is plural with no "other" branch`)
      }
      const expected = placeholdersOf(reference[key])
      const actual = placeholdersOf(message)
      for (const placeholder of expected) {
        if (!actual.has(placeholder)) {
          problems.push(`${name}: ${locale}.json "${key}" drops placeholder {${placeholder}}`)
        }
      }
      for (const placeholder of actual) {
        if (!expected.has(placeholder)) {
          problems.push(`${name}: ${locale}.json "${key}" adds placeholder {${placeholder}}`)
        }
      }
    }
  }

  return problems
}

/**
 * Finds every `<root>/<member>/src/i18n/` directory holding `.json` catalogues.
 *
 * @param {string[]} roots - Directories to scan.
 * @returns {Array<{name: string, catalogues: Record<string, unknown>}>} Groups.
 */
export function discoverGroups(roots) {
  const groups = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const member of readdirSync(root)) {
      const dir = join(root, member, 'src', 'i18n')
      if (!existsSync(dir)) continue
      const catalogues = {}
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) continue
        catalogues[basename(file, '.json')] = JSON.parse(readFileSync(join(dir, file), 'utf8'))
      }
      if (Object.keys(catalogues).length > 0) {
        groups.push({ name: `${root}/${member}`, catalogues })
      }
    }
  }
  return groups
}

/* istanbul ignore next -- CLI entry point, exercised by CI rather than by unit tests. */
function main() {
  const groups = discoverGroups(ROOTS)

  /*
   * Zero groups is the anti-vacuity guard. `packages/ui/src/i18n/` is
   * platform-role and survives `strip-reference.mjs`, so a tree with no groups
   * at all means discovery broke — not that there is nothing to check.
   */
  if (groups.length === 0) {
    console.error('No translation catalogues found. Discovery is broken, or ui/src/i18n was lost.')
    process.exit(1)
  }

  const problems = groups.flatMap((group) => checkGroup(group.name, group.catalogues))
  if (problems.length > 0) {
    console.error(`Catalogue check failed (${problems.length}):`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exit(1)
  }

  console.log(`Catalogues consistent across ${groups.length} group(s).`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
