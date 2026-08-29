import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STOREFRONT_API_VERSION, STOREFRONT_SCHEMA_SHA256 } from './version.ts'

const schemaDir = join(import.meta.dirname, '..', 'schema')

describe('vendored schema provenance', () => {
  it('exposes a calendar-versioned Storefront API version', () => {
    expect(STOREFRONT_API_VERSION).toMatch(/^\d{4}-\d{2}$/)
  })

  it('matches the checksum of the committed schema file', async () => {
    const bytes = await readFile(join(schemaDir, 'storefront.schema.json'))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(STOREFRONT_SCHEMA_SHA256)
  })

  it('describes a schema containing the types the operations depend on', async () => {
    const raw = await readFile(join(schemaDir, 'storefront.schema.json'), 'utf8')
    const schema = JSON.parse(raw) as { __schema: { types: { name: string }[] } }
    const names = new Set(schema.__schema.types.map((type) => type.name))
    for (const required of ['QueryRoot', 'Product', 'Collection', 'Cart', 'CartUserError']) {
      expect(names.has(required), `schema is missing ${required}`).toBe(true)
    }
  })
})
