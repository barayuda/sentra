import { describe, expect, it, vi } from 'vitest'
import { createOpsFlagSource } from './flags.ts'
import type { OpsClient } from '@sentra/sdk-ops'

describe('createOpsFlagSource', () => {
  it('maps the ops flag list to evaluation values', async () => {
    const listFlags = vi.fn<OpsClient['listFlags']>(async () => ({
      ok: true,
      value: [
        {
          key: 'orders.bulkActions',
          label: 'Bulk actions',
          enabled: true,
          updatedAt: '2026-01-01',
        },
      ],
    }))
    const source = createOpsFlagSource({ listFlags } as unknown as OpsClient)
    await expect(source.load({})).resolves.toEqual({ 'orders.bulkActions': true })
  })

  it('throws a fresh Error rather than leaking the transport failure', async () => {
    const listFlags = vi.fn<OpsClient['listFlags']>(async () => ({
      ok: false,
      error: {
        kind: 'network',
        message: 'GET https://ops.example/flags?token=abc failed',
        status: null,
      },
    }))
    const source = createOpsFlagSource({ listFlags } as unknown as OpsClient)
    await expect(source.load({})).rejects.toThrow('flag evaluation source unavailable')

    /*
     * `toThrow(string)` matches on substring, so the assertion above alone
     * would pass just as happily against an Error whose message *appends*
     * the transport's text — exactly the leak the fresh-`Error` rule exists
     * to prevent. Assert the absence of the transport message too: neither
     * the host nor the token-shaped query parameter may survive the
     * boundary, because whatever reaches `onError` may end up in an error
     * report.
     */
    let thrown: unknown
    try {
      await source.load({})
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Error)
    const message = (thrown as Error).message
    expect(message).not.toContain('ops.example')
    expect(message).not.toContain('token')
  })
})
