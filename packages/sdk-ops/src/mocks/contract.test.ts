import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createOpsClient } from '../client.ts'
import type { OpsError, OpsResult } from '../errors.ts'
import {
  FIXTURE_FLAGS,
  MOCK_OPS_TOKEN,
  OPS_MOCK_BASE_URL,
  createOpsHandlers,
  createOpsMockControl,
} from './index.ts'

/**
 * Asserts the result is a failure and returns its error.
 *
 * A bare `if (!result.ok)` guard silently passes when the result is a
 * success — the assertions inside never run, so a regression would look
 * identical to a fix. This throws instead, which is what makes these tests
 * able to fail.
 */
function expectFailure(result: OpsResult<unknown>): OpsError {
  if (result.ok) {
    throw new Error(`expected a failure, received ok(${JSON.stringify(result.value)})`)
  }
  return result.error
}

/**
 * The flag fixtures as they exist before any test mutates them.
 *
 * `FIXTURE_FLAGS` is mutated in place by the `PATCH /flags/:key` handler so a
 * toggle persists within a session, exactly as it would against a real
 * service. That is also exactly what makes it a flake generator across
 * tests: without restoring it, a `setFlag` test in one `it` block would leak
 * into the next.
 */
const SEED_FLAGS = FIXTURE_FLAGS.map((flag) => ({ ...flag }))

const control = createOpsMockControl()
const server = setupServer(...createOpsHandlers(control))

/** A client pointed at the mocked service, with retries that do not wait. */
function client() {
  return createOpsClient({
    baseUrl: OPS_MOCK_BASE_URL,
    token: MOCK_OPS_TOKEN,
    sleep: async () => {},
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  SEED_FLAGS.forEach((flag, index) => {
    FIXTURE_FLAGS[index] = { ...flag }
  })
  control.scenario = 'ok'
  control.latencyMs = 0
})
afterAll(() => server.close())

describe('orders', () => {
  it('lists a page of orders with the declared shape', async () => {
    const result = await client().listOrders({ limit: 5 })
    if (!result.ok) throw new Error('expected success')
    expect(result.value.orders).toHaveLength(5)
    expect(result.value.totalCount).toBe(37)
    expect(result.value.nextCursor).toBe('cursor-5')
    expect(result.value.orders[0]).toMatchObject({
      id: 'ord_0',
      reference: 'SEN-1000',
      status: expect.any(String),
      total: { amount: expect.any(String), currencyCode: 'IDR' },
      lineCount: expect.any(Number),
    })
  })

  it('walks to the second page using the first page cursor, without repeating an order', async () => {
    const sdk = client()
    const first = await sdk.listOrders({ limit: 10 })
    if (!first.ok) throw new Error('expected success')
    expect(first.value.nextCursor).not.toBeNull()

    const second = await sdk.listOrders({
      limit: 10,
      cursor: first.value.nextCursor ?? undefined,
    })
    if (!second.ok) throw new Error('expected success')
    expect(second.value.orders).toHaveLength(10)

    const firstIds = new Set(first.value.orders.map((order) => order.id))
    const secondIds = second.value.orders.map((order) => order.id)
    expect(secondIds.some((id) => firstIds.has(id))).toBe(false)
  })

  it('fetches one order with its lines', async () => {
    const result = await client().getOrder({ id: 'ord_1' })
    if (!result.ok || !result.value) throw new Error('expected an order')
    expect(result.value.id).toBe('ord_1')
    /* Opaque by construction — asserting the shape, never a real identifier. */
    expect(result.value.customerRef).toMatch(/^cus_[0-9a-f]+$/)
    expect(result.value.lines.length).toBeGreaterThan(0)
  })

  it('returns null for an order that does not exist', async () => {
    const result = await client().getOrder({ id: 'ord_does_not_exist' })
    expect(result).toEqual({ ok: true, value: null })
  })
})

describe('flags', () => {
  it('lists the seed flags', async () => {
    const result = await client().listFlags()
    if (!result.ok) throw new Error('expected success')
    expect(result.value).toEqual(SEED_FLAGS)
  })

  it('setFlag mutates the shared fixture, which listFlags then reflects', async () => {
    const sdk = client()
    const before = await sdk.listFlags()
    if (!before.ok) throw new Error('expected success')
    expect(before.value.find((flag) => flag.key === 'new-checkout')?.enabled).toBe(false)

    const updated = await sdk.setFlag({ key: 'new-checkout', enabled: true })
    if (!updated.ok) throw new Error('expected success')
    expect(updated.value.enabled).toBe(true)

    const after = await sdk.listFlags()
    if (!after.ok) throw new Error('expected success')
    expect(after.value.find((flag) => flag.key === 'new-checkout')?.enabled).toBe(true)
  })

  it('does not leak the previous test’s toggle, proving the reset actually runs', async () => {
    /* This has no setFlag call of its own. If the `afterEach` reset above did
       not restore `FIXTURE_FLAGS`, this would still see `enabled: true` left
       over from the previous test. */
    const result = await client().listFlags()
    if (!result.ok) throw new Error('expected success')
    expect(result.value).toEqual(SEED_FLAGS)
  })
})

describe('failure scenarios', () => {
  it('produces an auth error when the ops role is missing', async () => {
    control.scenario = 'auth'
    const result = await client().listOrders({ limit: 5 })
    expect(expectFailure(result)).toMatchObject({ kind: 'auth' })
  })

  it('produces a network error when the request cannot complete', async () => {
    control.scenario = 'network'
    const result = await client().listFlags()
    expect(expectFailure(result)).toMatchObject({ kind: 'network' })
  })

  it('produces a validation error naming the field when setFlag is rejected', async () => {
    control.scenario = 'validation'
    const result = await client().setFlag({ key: 'new-checkout', enabled: true })
    expect(expectFailure(result)).toMatchObject({ kind: 'validation', field: 'enabled' })
  })

  it('produces a schema error when the response drops a required field', async () => {
    control.scenario = 'schema_drift'
    const result = await client().getOrder({ id: 'ord_1' })
    expect(expectFailure(result)).toMatchObject({ kind: 'schema', path: '$.reference' })
  })
})
