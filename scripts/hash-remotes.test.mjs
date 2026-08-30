import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { sriHash } from './hash-remotes.mjs'

describe('sriHash', () => {
  it('produces a base64 sha384 digest in SRI form', () => {
    const bytes = Buffer.from('console.log(1)\n')
    const expected = `sha384-${createHash('sha384').update(bytes).digest('base64')}`
    expect(sriHash(bytes)).toBe(expected)
  })

  it('matches the pattern the manifest parser accepts', () => {
    expect(sriHash(Buffer.from('x'))).toMatch(/^sha384-[A-Za-z0-9+/]{64}={0,2}$/)
  })

  it('changes when a single byte changes', () => {
    expect(sriHash(Buffer.from('a'))).not.toBe(sriHash(Buffer.from('b')))
  })
})
