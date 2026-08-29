import { describe, expect, it, vi } from 'vitest'
import type { OpsTransport } from '../transport.ts'
import { listFlags, setFlag } from './flags.ts'

const WIRE_FLAG = {
  key: 'new-checkout',
  label: 'New checkout',
  enabled: false,
  updatedAt: '2026-08-20T04:00:00.000Z',
}

describe('listFlags', () => {
  it('maps the wire array', async () => {
    const transport = {
      request: vi.fn(async () => ({ ok: true as const, value: { flags: [WIRE_FLAG] } })),
    } as unknown as OpsTransport

    const result = await listFlags(transport)

    if (!result.ok) throw new Error('expected ok')
    expect(result.value).toEqual([WIRE_FLAG])
  })

  it('reports a non-boolean enabled as a schema error', async () => {
    const transport = {
      request: vi.fn(async () => ({
        ok: true as const,
        value: { flags: [{ ...WIRE_FLAG, enabled: 'yes' }] },
      })),
    } as unknown as OpsTransport

    const result = await listFlags(transport)

    if (result.ok) throw new Error('expected a schema error')
    expect(result.error.kind).toBe('schema')
  })
})

describe('setFlag', () => {
  it('PATCHes the key with the new state', async () => {
    const request = vi.fn(async () => ({
      ok: true as const,
      value: { ...WIRE_FLAG, enabled: true },
    }))
    const transport = { request } as unknown as OpsTransport

    const result = await setFlag(transport, { key: 'new-checkout', enabled: true })

    expect(request).toHaveBeenCalledWith('PATCH', '/flags/new-checkout', { enabled: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.value.enabled).toBe(true)
  })

  it('escapes a key that would otherwise change the path', async () => {
    const request = vi.fn(async () => ({ ok: true as const, value: WIRE_FLAG }))
    const transport = { request } as unknown as OpsTransport

    await setFlag(transport, { key: '../admin', enabled: true })

    expect(request).toHaveBeenCalledWith('PATCH', '/flags/..%2Fadmin', { enabled: true })
  })

  it('passes a validation failure through unchanged', async () => {
    const transport = {
      request: vi.fn(async () => ({
        ok: false as const,
        error: { kind: 'validation' as const, message: 'unknown flag', field: 'key' },
      })),
    } as unknown as OpsTransport

    const result = await setFlag(transport, { key: 'nope', enabled: true })

    if (result.ok) throw new Error('expected failure')
    expect(result.error).toEqual({ kind: 'validation', message: 'unknown flag', field: 'key' })
  })
})
