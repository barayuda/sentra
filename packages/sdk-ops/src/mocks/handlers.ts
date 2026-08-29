import { HttpResponse, delay, http, type RequestHandler } from 'msw'
import type { OrderSortKey, SortDirection } from '../types.ts'
import { FIXTURE_FLAGS, FIXTURE_ORDERS, MOCK_OPS_TOKEN, OPS_MOCK_BASE_URL } from './fixtures.ts'

/** Which behaviour the handlers should exhibit. */
export type OpsMockScenario = 'ok' | 'network' | 'auth' | 'validation' | 'schema_drift'

/** Mutable knob shared with whoever installed the handlers. */
export interface OpsMockControl {
  /** Current behaviour. */
  scenario: OpsMockScenario
  /** Artificial latency in milliseconds, for exercising loading states. */
  latencyMs: number
}

/** Creates a control object defaulting to the happy path. */
export function createOpsMockControl(): OpsMockControl {
  return { scenario: 'ok', latencyMs: 0 }
}

/** Reads a sort key from the query string, falling back to the default. */
function sortKeyOf(value: string | null): OrderSortKey {
  return value === 'reference' || value === 'status' || value === 'total' ? value : 'placedAt'
}

/**
 * Builds handlers bound to a control object.
 *
 * Sorting and pagination happen here rather than in the console, because the
 * point of the console's table is that it is *server-shaped*: the client asks
 * for a page in an order and renders what it gets. A mock that sorted
 * client-side would let a wrong implementation pass.
 *
 * @param control - Scenario switch; a fresh happy-path control when omitted.
 */
export function createOpsHandlers(
  control: OpsMockControl = createOpsMockControl(),
): RequestHandler[] {
  return [
    http.get(`${OPS_MOCK_BASE_URL}/orders`, async ({ request }) => {
      if (control.latencyMs > 0) await delay(control.latencyMs)
      if (control.scenario === 'network') return HttpResponse.error()
      if (control.scenario === 'auth') {
        return HttpResponse.json({ message: 'ops role required' }, { status: 403 })
      }
      if (request.headers.get('Authorization') !== `Bearer ${MOCK_OPS_TOKEN}`) {
        return HttpResponse.json({ message: 'token rejected' }, { status: 401 })
      }

      const url = new URL(request.url)
      const limit = Number(url.searchParams.get('limit') ?? '20')
      const cursor = Number(url.searchParams.get('cursor')?.replace('cursor-', '') ?? '0')
      const sort = sortKeyOf(url.searchParams.get('sort'))
      const direction: SortDirection = url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc'

      const sorted = [...FIXTURE_ORDERS].sort((left, right) => {
        /* Lexicographic comparison is correct for `placedAt`/`reference`/`status`
           only because every fixture value shares the same field widths (fixed
           ISO-8601 timestamps, `SEN-<4 digits>`, a fixed set of status strings).
           Widening the fixtures without keeping widths uniform breaks this. */
        const [a, b] =
          sort === 'total'
            ? [Number(left.total.amount), Number(right.total.amount)]
            : [String(left[sort]), String(right[sort])]
        const order = a < b ? -1 : a > b ? 1 : 0
        return direction === 'asc' ? order : -order
      })

      const slice = sorted.slice(cursor, cursor + limit)
      const end = cursor + slice.length
      return HttpResponse.json({
        orders: slice.map(({ customerRef: _customerRef, lines: _lines, ...summary }) => summary),
        nextCursor: end < sorted.length ? `cursor-${end}` : null,
        totalCount: sorted.length,
      })
    }),

    http.get(`${OPS_MOCK_BASE_URL}/orders/:id`, async ({ params }) => {
      if (control.latencyMs > 0) await delay(control.latencyMs)
      if (control.scenario === 'network') return HttpResponse.error()
      const order = FIXTURE_ORDERS.find((candidate) => candidate.id === params.id)
      if (!order) return HttpResponse.json({ message: 'not found' }, { status: 404 })
      if (control.scenario === 'schema_drift') {
        /* Drop a field the types declare non-nullable — what a real schema
           change looks like from the client's side. */
        return HttpResponse.json({ ...order, reference: null })
      }
      return HttpResponse.json(order)
    }),

    http.get(`${OPS_MOCK_BASE_URL}/flags`, async () => {
      if (control.latencyMs > 0) await delay(control.latencyMs)
      if (control.scenario === 'network') return HttpResponse.error()
      return HttpResponse.json({ flags: FIXTURE_FLAGS })
    }),

    http.patch(`${OPS_MOCK_BASE_URL}/flags/:key`, async ({ params, request }) => {
      if (control.latencyMs > 0) await delay(control.latencyMs)
      if (control.scenario === 'network') return HttpResponse.error()
      if (control.scenario === 'validation') {
        return HttpResponse.json(
          { message: 'flag is locked by policy', field: 'enabled' },
          { status: 422 },
        )
      }
      const index = FIXTURE_FLAGS.findIndex((flag) => flag.key === params.key)
      const existing = FIXTURE_FLAGS[index]
      if (!existing) {
        return HttpResponse.json({ message: 'unknown flag', field: 'key' }, { status: 422 })
      }
      const body = (await request.json()) as { enabled?: unknown }
      if (typeof body.enabled !== 'boolean') {
        return HttpResponse.json(
          { message: 'enabled must be a boolean', field: 'enabled' },
          { status: 422 },
        )
      }
      const updated = { ...existing, enabled: body.enabled, updatedAt: '2026-08-29T00:00:00.000Z' }
      FIXTURE_FLAGS[index] = updated
      return HttpResponse.json(updated)
    }),
  ]
}
