#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** Repository root, derived from this file so the cwd does not matter. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Manifest to rewrite, and where each container's built entry lives.
 *
 * The **built** manifest under `dist/`, never the source under `public/`.
 * Ruling PF-1 forbids committed digests, and pointing this at the source file
 * would make that rule depend on nobody ever running the script in a checkout.
 * Writing only to build output makes it structural instead: there is no path
 * by which a digest reaches version control.
 */
const MANIFEST_PATH = join(ROOT, 'apps/shell/dist/remotes.json')
const ENTRY_PATHS = {
  storefront: join(ROOT, 'apps/storefront/dist/remoteEntry.js'),
  console: join(ROOT, 'apps/console/dist/remoteEntry.js'),
}

/**
 * Computes a Subresource Integrity digest.
 *
 * SHA-384 rather than SHA-256: it is the SRI default in practice and long
 * enough that a collision is not a live concern for a control whose whole job
 * is detecting substitution.
 *
 * @param {Buffer} buffer - File contents.
 * @returns {string} `sha384-<base64>`.
 */
export function sriHash(buffer) {
  return `sha384-${createHash('sha384').update(buffer).digest('base64')}`
}

/**
 * Stamps each manifest entry with the digest of its built remote entry.
 *
 * Run after building the remotes and before serving the shell. Failure is
 * loud on purpose: leaving an entry unhashed is exactly how a supply-chain
 * control gets silently disabled, and the consumer refuses unhashed entries in
 * a production build. A platform-only tree needs no exemption here — the strip
 * prunes the manifest to `[]`, so there is nothing to hash rather than
 * something that cannot be hashed.
 *
 * Named risk area: supply chain.
 */
async function main() {
  const entries = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  const failures = []

  for (const entry of entries) {
    const path = ENTRY_PATHS[entry.name]
    if (path === undefined) {
      failures.push(`no built entry is known for manifest entry "${entry.name}"`)
      continue
    }
    try {
      entry.integrity = sriHash(await readFile(path))
      console.log(`hash-remotes: ${entry.name} ${entry.integrity}`)
    } catch {
      failures.push(`${path} is not built — cannot hash "${entry.name}"`)
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`hash-remotes failed: ${failure}`)
    console.error('every manifest entry must be hashed; build the remotes first')
    process.exit(1)
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(entries, null, 2)}\n`)

  /* An empty manifest is a real state — the strip prunes it to `[]` — but it is
     also what a broken build or a truncating bug produces, and a loop over zero
     entries collects zero failures. The two outcomes must not print the same
     line: "stamped 0 entries" alongside a plain success reads as a control that
     ran, when nothing was checked. This does not exit non-zero, because in a
     platform-only tree the state is correct; the federated E2E suite is what
     turns a wrongly-empty manifest red. */
  if (entries.length === 0) {
    console.log(
      'hash-remotes: manifest is empty, so nothing was hashed. Correct for a platform-only tree; in a tree with remotes it means the manifest lost its entries.',
    )
    return
  }
  console.log(`hash-remotes: stamped ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`)
}

if (process.argv[1]?.endsWith('hash-remotes.mjs')) await main()
