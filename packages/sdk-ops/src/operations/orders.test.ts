import { describe, expect, it, vi } from 'vitest'
import type { OpsTransport } from '../transport.ts'
import { getOrder, listOrders } from './orders.ts'

const WIRE_SUMMARY = {
  id: 'ord_1',
  reference: 'SEN-1042',
  placedAt: '2026-08-01T09:15:00.000Z',
  status: 'paid',
  total: { amount: '149.00', currencyCode: 'IDR' },
  lineCount: 2,
}

/** A transport whose single response is scripted. */
function transportReturning(value: unknown): OpsTransport {
  return { request: vi.fn(async () => ({ ok: true as const, value })) as OpsTransport['request'] }
}

describe('listOrders', () => {
  it('maps a wire page to the domain shape', async () => {
    const transport = transportReturning({
      orders: [WIRE_SUMMARY],
      nextCursor: 'cursor-1',
      totalCount: 37,
    })

    const result = await listOrders(transport, { limit: 20 })

    if (!result.ok) throw new Error(`expected ok, got ${result.error.kind}`)
    expect(result.value.totalCount).toBe(37)
    expect(result.value.nextCursor).toBe('cursor-1')
    expect(result.value.orders[0]?.reference).toBe('SEN-1042')
  })

  it('puts every query parameter in the path', async () => {
    const request = vi.fn(async () => ({
      ok: true as const,
      value: { orders: [], nextCursor: null, totalCount: 0 },
    }))
    const transport = { request } as unknown as OpsTransport

    await listOrders(transport, {
      limit: 10,
      cursor: 'cursor-2',
      sort: 'reference',
      direction: 'desc',
    })

    expect(request).toHaveBeenCalledWith(
      'GET',
      '/orders?limit=10&cursor=cursor-2&sort=reference&direction=desc',
    )
  })

  it('omits absent parameters rather than sending empty values', async () => {
    const request = vi.fn(async () => ({
      ok: true as const,
      value: { orders: [], nextCursor: null, totalCount: 0 },
    }))
    const transport = { request } as unknown as OpsTransport

    await listOrders(transport, { limit: 10 })

    expect(request).toHaveBeenCalledWith('GET', '/orders?limit=10')
  })

  it('reports a missing field as a schema error naming the path', async () => {
    const transport = transportReturning({
      orders: [{ ...WIRE_SUMMARY, reference: undefined }],
      nextCursor: null,
      totalCount: 1,
    })

    const result = await listOrders(transport, { limit: 20 })

    if (result.ok) throw new Error('expected a schema error')
    expect(result.error.kind).toBe('schema')
    if (result.error.kind !== 'schema') throw new Error('unreachable')
    expect(result.error.path).toBe('$.orders[0].reference')
  })

  it('rejects an unrecognised status rather than passing it through', async () => {
    const transport = transportReturning({
      orders: [{ ...WIRE_SUMMARY, status: 'teleported' }],
      nextCursor: null,
      totalCount: 1,
    })

    const result = await listOrders(transport, { limit: 20 })

    if (result.ok) throw new Error('expected a schema error')
    expect(result.error.kind).toBe('schema')
  })
})

describe('getOrder', () => {
  it('maps an order with its lines', async () => {
    const transport = transportReturning({
      ...WIRE_SUMMARY,
      customerRef: 'cus_8f2a',
      lines: [
        {
          id: 'line_1',
          title: 'Stoneware Bowl',
          quantity: 2,
          total: { amount: '98.00', currencyCode: 'IDR' },
        },
      ],
    })

    const result = await getOrder(transport, { id: 'ord_1' })

    if (!result.ok) throw new Error('expected ok')
    expect(result.value?.customerRef).toBe('cus_8f2a')
    expect(result.value?.lines[0]?.quantity).toBe(2)
  })

  it('returns null for an order that does not exist', async () => {
    const transport = {
      request: vi.fn(async () => ({
        ok: false as const,
        error: { kind: 'network' as const, message: 'upstream responded 404', status: 404 },
      })),
    } as unknown as OpsTransport

    const result = await getOrder(transport, { id: 'ord_missing' })

    expect(result).toEqual({ ok: true, value: null })
  })

  it('does not swallow a 500 as a missing order', async () => {
    const transport = {
      request: vi.fn(async () => ({
        ok: false as const,
        error: { kind: 'network' as const, message: 'upstream responded 500', status: 500 },
      })),
    } as unknown as OpsTransport

    const result = await getOrder(transport, { id: 'ord_1' })

    expect(result.ok).toBe(false)
  })
})
