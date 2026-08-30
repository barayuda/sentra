#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

/** Directories `pnpm-workspace.yaml` globs. Kept literal — the file uses two fixed globs. */
const MEMBER_ROOTS = ['packages', 'apps']

/** Roles a workspace member may declare. */
const ROLES = ['platform', 'reference']

/**
 * @typedef {object} Member
 * @property {string} dir - Path relative to the workspace root.
 * @property {string} name - The package name.
 * @property {string | null} role - Declared `sentra.role`, or null when absent.
 */

/**
 * Reads every workspace member and its declared role.
 *
 * @param {string} rootDir - Workspace root.
 * @returns {Promise<Member[]>} One entry per member, in directory order.
 */
export async function readWorkspaceMembers(rootDir) {
  const members = []
  for (const root of MEMBER_ROOTS) {
    let entries
    try {
      entries = await readdir(join(rootDir, root), { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = `${root}/${entry.name}`
      let pkg
      try {
        pkg = JSON.parse(await readFile(join(rootDir, dir, 'package.json'), 'utf8'))
      } catch {
        continue
      }
      const role = pkg?.sentra?.role ?? null
      members.push({ dir, name: pkg.name, role })
    }
  }
  return members
}

/**
 * Finds everything wrong with a set of declared roles.
 *
 * A member with no role is a failure, not a default. Defaulting would mean a
 * new package silently joins the platform core and quietly breaks the delete
 * path months later; failing here costs one line in a `package.json`.
 *
 * @param {Member[]} members - Members to check.
 * @returns {string[]} Human-readable problems; empty when the set is valid.
 */
export function roleProblems(members) {
  const problems = []
  for (const member of members) {
    if (member.role === null) {
      problems.push(`${member.name} (${member.dir}) declares no sentra.role`)
    } else if (!ROLES.includes(member.role)) {
      problems.push(
        `${member.name} (${member.dir}) declares sentra.role "${member.role}" — expected one of ${ROLES.join(', ')}`,
      )
    }
  }
  if (!members.some((member) => member.role === 'platform')) {
    problems.push('no platform member found — the platform cannot be empty')
  }
  return problems
}

/** Fails the build when any workspace member's role is missing or invalid. */
async function main() {
  const members = await readWorkspaceMembers(process.cwd())
  const problems = roleProblems(members)
  if (problems.length > 0) {
    for (const problem of problems) console.error(`role check failed: ${problem}`)
    process.exit(1)
  }
  const platform = members.filter((m) => m.role === 'platform').length
  const reference = members.length - platform
  console.log(`role check passed: ${platform} platform, ${reference} reference`)
}

if (process.argv.includes('--check')) await main()
