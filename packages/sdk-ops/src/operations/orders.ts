import { ok, type Result } from '@sentra/result'
import type { OpsError, OpsResult } from '../errors.ts'
import type {
  OrderDetail,
  OrderLine,
  OrderPage,
  OrderSortKey,
  OrderStatus,
  OrderSummary,
  SortDirection,
} from '../types.ts'
import type { OpsTransport } from '../transport.ts'
import { mapResult, required, requiredNumber, requiredString, SchemaViolation } from './assert.ts'

/** Every value `OrderStatus` admits, for runtime checking. */
const ORDER_STATUSES: readonly string[] = ['pending', 'paid', 'fulfilled', 'refunded', 'cancelled']

/** Input for {@link listOrders}. */
export interface ListOrdersInput {
  /** Page size. */
  readonly limit: number
  /** Cursor from a previous page's `nextCursor`. */
  readonly cursor?: string
  /** Field to sort by. */
  readonly sort?: OrderSortKey
  /** Sort direction. */
  readonly direction?: SortDirection
}

/**
 * Narrows an unknown status.
 *
 * A cast would let a status the UI has no branch for reach a `<span>` and
 * render as raw text. Checking here turns that into a schema error with a
 * path, which is an operational signal rather than a cosmetic bug.
 *
 * @param value - Value read from the response.
 * @param path - JSON path, for the error message.
 */
function requiredStatus(value: unknown, path: string): OrderStatus {
  const status = requiredString(value, path)
  if (!ORDER_STATUSES.includes(status)) {
    throw new SchemaViolation(`unknown order status "${status}" at ${path}`, path)
  }
  return status as OrderStatus
}

/** Maps a wire money object. */
function toMoney(value: unknown, path: string): OrderSummary['total'] {
  const record = required(value, path) as Record<string, unknown>
  return {
    amount: requiredString(record.amount, `${path}.amount`),
    currencyCode: requiredString(record.currencyCode, `${path}.currencyCode`),
  }
}

/** Maps a wire order summary. */
function toSummary(value: unknown, path: string): OrderSummary {
  const record = required(value, path) as Record<string, unknown>
  return {
    id: requiredString(record.id, `${path}.id`),
    reference: requiredString(record.reference, `${path}.reference`),
    placedAt: requiredString(record.placedAt, `${path}.placedAt`),
    status: requiredStatus(record.status, `${path}.status`),
    total: toMoney(record.total, `${path}.total`),
    lineCount: requiredNumber(record.lineCount, `${path}.lineCount`),
  }
}

/** Maps a wire order line. */
function toLine(value: unknown, path: string): OrderLine {
  const record = required(value, path) as Record<string, unknown>
  return {
    id: requiredString(record.id, `${path}.id`),
    title: requiredString(record.title, `${path}.title`),
    quantity: requiredNumber(record.quantity, `${path}.quantity`),
    total: toMoney(record.total, `${path}.total`),
  }
}

/**
 * Fetches one page of orders.
 *
 * @param transport - See {@link OpsTransport}.
 * @param input - See {@link ListOrdersInput}.
 */
export async function listOrders(
  transport: OpsTransport,
  input: ListOrdersInput,
): Promise<OpsResult<OrderPage>> {
  const query = new URLSearchParams({ limit: String(input.limit) })
  if (input.cursor !== undefined) query.set('cursor', input.cursor)
  if (input.sort !== undefined) query.set('sort', input.sort)
  if (input.direction !== undefined) query.set('direction', input.direction)

  const response = await transport.request<unknown>('GET', `/orders?${query.toString()}`)
  return mapResult(response, (wire) => {
    const record = required(wire, '$') as Record<string, unknown>
    const rawOrders = required(record.orders, '$.orders')
    if (!Array.isArray(rawOrders)) {
      throw new SchemaViolation('expected an array at $.orders', '$.orders')
    }
    return {
      orders: rawOrders.map((order, index) => toSummary(order, `$.orders[${index}]`)),
      nextCursor: typeof record.nextCursor === 'string' ? record.nextCursor : null,
      totalCount: requiredNumber(record.totalCount, '$.totalCount'),
    }
  })
}

/** Input for {@link getOrder}. */
export interface GetOrderInput {
  /** Order identifier. */
  readonly id: string
}

/**
 * Fetches one order with its lines.
 *
 * A 404 becomes `ok(null)` rather than an error: "this order does not exist"
 * is an answer the console renders as an empty state, not a failure it should
 * retry or alarm on. Every other status stays an error — collapsing a 500
 * into "not found" would hide an outage behind a blank page.
 *
 * @param transport - See {@link OpsTransport}.
 * @param input - See {@link GetOrderInput}.
 */
export async function getOrder(
  transport: OpsTransport,
  input: GetOrderInput,
): Promise<OpsResult<OrderDetail | null>> {
  const response: Result<unknown, OpsError> = await transport.request<unknown>(
    'GET',
    `/orders/${encodeURIComponent(input.id)}`,
  )
  if (!response.ok && response.error.kind === 'network' && response.error.status === 404) {
    return ok(null)
  }
  return mapResult(response, (wire) => {
    const summary = toSummary(wire, '$')
    const record = wire as Record<string, unknown>
    const rawLines = required(record.lines, '$.lines')
    if (!Array.isArray(rawLines)) {
      throw new SchemaViolation('expected an array at $.lines', '$.lines')
    }
    return {
      ...summary,
      customerRef: requiredString(record.customerRef, '$.customerRef'),
      lines: rawLines.map((line, index) => toLine(line, `$.lines[${index}]`)),
    }
  })
}
