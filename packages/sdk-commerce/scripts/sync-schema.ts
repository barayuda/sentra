/**
 * Vendors the published Shopify Storefront API introspection schema into
 * `schema/`, and records where it came from.
 *
 * Why vendor at all: introspecting a live store would make the type pipeline
 * depend on network access and on someone's store staying alive, and it would
 * make schema drift invisible — types would silently change under us. A
 * committed schema turns drift into a reviewable diff, which is precisely the
 * failure mode `SchemaError` exists to report at runtime.
 *
 * Why this source: `@shopify/hydrogen-react` is Shopify's own package and
 * ships `storefront.schema.json` for exactly this purpose. Its calendar
 * version (e.g. `2026.4.3`) names the API version the schema describes
 * (`2026-04`), so the dependency version IS the provenance record.
 *
 * Run with `pnpm --filter @sentra/sdk-commerce sync-schema`.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Pinned source of the vendored schema.
 *
 * Fetched on demand rather than declared as a dependency: the schema is
 * committed, so a permanent devDependency would drag `@google/model-viewer`
 * and `three` into every install of this monorepo for a file that already
 * lives in git. The version is pinned here and recorded in PROVENANCE.json,
 * so the vendoring stays reproducible without the install cost.
 */
const SOURCE_PACKAGE = '@shopify/hydrogen-react'
const SOURCE_VERSION = '2026.4.3'

/** Converts hydrogen-react's calendar version to a Storefront API version. */
export function toApiVersion(packageVersion: string): string {
  const [year, month] = packageVersion.split('.')
  if (!year || !month) throw new Error(`Unrecognised hydrogen-react version: ${packageVersion}`)
  return `${year}-${month.padStart(2, '0')}`
}

async function main(): Promise<void> {
  const packageRoot = resolve(import.meta.dirname, '..')
  const schemaDir = join(packageRoot, 'schema')
  const workDir = await mkdtemp(join(tmpdir(), 'sentra-schema-'))

  try {
    /* `npm pack` prints the tarball filename on stdout; notices go to stderr. */
    const tarball = execFileSync('npm', ['pack', `${SOURCE_PACKAGE}@${SOURCE_VERSION}`], {
      cwd: workDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }).trim()

    execFileSync('tar', ['-xzf', tarball, 'package/storefront.schema.json'], {
      cwd: workDir,
      stdio: ['ignore', 'ignore', 'inherit'],
    })

    await mkdir(schemaDir, { recursive: true })
    const target = join(schemaDir, 'storefront.schema.json')
    await copyFile(join(workDir, 'package', 'storefront.schema.json'), target)

    const bytes = await readFile(target)
    const provenance = {
      source: SOURCE_PACKAGE,
      sourceVersion: SOURCE_VERSION,
      storefrontApiVersion: toApiVersion(SOURCE_VERSION),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.byteLength,
    }
    await writeFile(join(schemaDir, 'PROVENANCE.json'), `${JSON.stringify(provenance, null, 2)}\n`)

    console.log(
      `Vendored Storefront schema ${provenance.storefrontApiVersion} ` +
        `from ${provenance.source}@${provenance.sourceVersion} (${provenance.bytes} bytes)`,
    )
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

await main()
