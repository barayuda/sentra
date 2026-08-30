#!/usr/bin/env node
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { validateSourceOwners } from './csp.mjs'
import { readWorkspaceMembers } from './workspace.mjs'

/** Where the shell publishes its runtime remote registry. */
const MANIFEST_PATH = 'apps/shell/public/remotes.json'
/** Origins the shell allows on behalf of remote code, each with a declared owner. */
const CSP_SOURCES_PATH = 'security/csp-sources.json'

/**
 * Removes manifest entries belonging to deleted reference members.
 *
 * Matching is on the federation container name, which is also the manifest's
 * `name` — the two are required to agree by ADR 0004, so there is no second
 * mapping to keep in sync.
 *
 * @param {Array<{name: string}>} entries - Parsed manifest entries.
 * @param {Set<string>} referenceNames - Container names being removed.
 * @returns {Array<{name: string}>} The surviving entries, in order.
 */
export function pruneManifest(entries, referenceNames) {
  return entries.filter((entry) => !referenceNames.has(entry.name))
}

/**
 * Removes reference-owned origins from a parsed `csp-sources.json`.
 *
 * A directive that loses all of its origins keeps an empty record rather than
 * disappearing. The directive still exists in the base policy either way, and
 * an empty object states "nothing widens this here" where an absent key states
 * only "nobody wrote anything," which is the same text an accidental deletion
 * leaves behind.
 *
 * @param {Record<string, unknown>} file - Parsed `csp-sources.json`.
 * @returns {Record<string, unknown>} A copy with every reference-owned origin removed.
 */
export function pruneCspSources(file) {
  const pruned = {}
  for (const [directive, origins] of Object.entries(file)) {
    if (directive.startsWith('$')) {
      pruned[directive] = origins
      continue
    }
    pruned[directive] = Object.fromEntries(
      Object.entries(origins ?? {}).filter(([, record]) => record?.owner !== 'reference'),
    )
  }
  return pruned
}

/**
 * Reads the reference-owned documentation directories from the root manifest.
 *
 * Workspace members carry their own `sentra.role`; a docs directory has no
 * `package.json` to carry one, so the root declares the list instead. An absent
 * or malformed key yields an empty list — for a routine whose next act is
 * `rm -r`, the only safe reading of "no list" is "delete nothing."
 *
 * @param {string} rootDir - Workspace root.
 * @returns {Promise<string[]>} Repo-relative directories, or `[]`.
 */
export async function readReferenceDocs(rootDir) {
  try {
    const manifest = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'))
    const declared = manifest?.sentra?.referenceDocs
    return Array.isArray(declared) ? declared.filter((dir) => typeof dir === 'string') : []
  } catch {
    return []
  }
}

/**
 * Reads the reference-owned config files from the root manifest.
 *
 * Same shape as {@link readReferenceDocs}: a Lighthouse config that audits a
 * reference app (e.g. `apps/storefront`) has no `sentra.role` of its own to
 * carry, so the root declares the list instead. An absent or malformed key
 * yields an empty list — for a routine whose next act is `rm`, the only safe
 * reading of "no list" is "delete nothing."
 *
 * @param {string} rootDir - Workspace root.
 * @returns {Promise<string[]>} Repo-relative file paths, or `[]`.
 */
export async function readReferenceConfigs(rootDir) {
  try {
    const manifest = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'))
    const declared = manifest?.sentra?.referenceConfigs
    return Array.isArray(declared) ? declared.filter((file) => typeof file === 'string') : []
  } catch {
    return []
  }
}

/**
 * Deletes every reference member and prunes the shell's manifest.
 *
 * Destructive by design and never run against a developer's checkout by CI —
 * see the `platform-only` job, which does this inside a throwaway clone. Run
 * it locally only when you actually intend to keep the platform and discard
 * the examples.
 *
 * `pnpm-workspace.yaml` needs no edit: it globs `packages/*` and `apps/*`, so
 * a deleted directory leaves the workspace on its own.
 *
 * @param {string} rootDir - Workspace root.
 * @returns {Promise<{removed: string[], removedDocs: string[], removedConfigs: string[]}>} What was deleted.
 */
export async function stripReference(rootDir) {
  const members = await readWorkspaceMembers(rootDir)
  const reference = members.filter((member) => member.role === 'reference')
  const referenceDocs = await readReferenceDocs(rootDir)
  const referenceConfigs = await readReferenceConfigs(rootDir)

  /* The manifest names federation containers ("storefront"), not package names
     ("@sentra/storefront"), so match on the last path segment of the member
     directory, which the repository keeps identical to the container name. */
  const containerNames = new Set(reference.map((member) => member.dir.split('/').at(-1)))

  const manifestPath = join(rootDir, MANIFEST_PATH)
  try {
    const entries = JSON.parse(await readFile(manifestPath, 'utf8'))
    await writeFile(
      manifestPath,
      `${JSON.stringify(pruneManifest(entries, containerNames), null, 2)}\n`,
    )
  } catch {
    /* No manifest is a valid state for a platform-only tree. */
  }

  const cspPath = join(rootDir, CSP_SOURCES_PATH)
  try {
    const sources = JSON.parse(await readFile(cspPath, 'utf8'))
    /* Validate before pruning. An entry with no owner cannot be classified, and
       silently keeping it is the over-permissive outcome this whole mechanism
       exists to prevent. */
    validateSourceOwners(sources)
    await writeFile(cspPath, `${JSON.stringify(pruneCspSources(sources), null, 2)}\n`)
  } catch (error) {
    /* An absent sources file is a valid platform-only state, exactly as an
       absent manifest is. A *malformed* one is not, and must not be swallowed:
       a bare `catch` here would turn a JSON syntax error, a bad owner, or a
       renamed path into a silent no-op that leaves every reference origin in
       the policy while the strip reports success. */
    if (error.code !== 'ENOENT') throw error
  }

  for (const member of reference) {
    await rm(join(rootDir, member.dir), { recursive: true, force: true })
  }

  for (const dir of referenceDocs) {
    await rm(join(rootDir, dir), { recursive: true, force: true })
  }

  for (const file of referenceConfigs) {
    await rm(join(rootDir, file), { recursive: true, force: true })
  }

  return {
    removed: reference.map((member) => member.dir),
    removedDocs: referenceDocs,
    removedConfigs: referenceConfigs,
  }
}

/** Strips the current working tree. */
async function main() {
  const { removed, removedDocs, removedConfigs } = await stripReference(process.cwd())
  if (removed.length === 0 && removedDocs.length === 0 && removedConfigs.length === 0) {
    console.log('strip-reference: nothing to remove')
    return
  }
  for (const dir of [...removed, ...removedDocs, ...removedConfigs]) {
    console.log(`strip-reference: removed ${dir}`)
  }
}

if (process.argv[1]?.endsWith('strip-reference.mjs')) await main()
