import { describe, expect, it, vi } from 'vitest'
import type { RequestCost, StorefrontError, StorefrontResult } from './errors.ts'
import { createStorefrontTransport, retryDelayMs } from './transport.ts'

const ENDPOINT = 'https://demo-shop.myshopify.com/api/2026-04/graphql.json'
const DOCUMENT = 'query Ping { shop { name } }'

/** Builds a Response with a JSON body, as `fetch` would. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Asserts the result is a failure and returns its error.
 *
 * A bare `if (!result.ok) { … }` guard silently passes when the result is a
 * success — the assertions inside simply never run — so a regression that
 * returned `ok` or the wrong error kind would look identical to a fix. This
 * throws instead, which is what makes these tests able to fail.
 */
function expectFailure(result: StorefrontResult<unknown>): StorefrontError {
  if (result.ok) {
    throw new Error(`expected a failure, received ok(${JSON.stringify(result.value)})`)
  }
  return result.error
}

const COST = {
  requestedQueryCost: 12,
  actualQueryCost: 10,
  throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 988, restoreRate: 50 },
}

/** A transport whose retries do not actually wait. */
function transportWith(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return createStorefrontTransport({
    endpoint: ENDPOINT,
    token: 'public-token',
    fetchImpl,
    sleep: async () => {},
    ...overrides,
  })
}

describe('createStorefrontTransport', () => {
  it('posts the document and variables to the endpoint with the access token', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { shop: { name: 'Sentra' } } }))
    const transport = transportWith(fetchImpl as unknown as typeof fetch)

    await transport.request(DOCUMENT, { handle: 'mugs' })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(ENDPOINT)
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['X-Shopify-Storefront-Access-Token']).toBe('public-token')
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({
      query: DOCUMENT,
      variables: { handle: 'mugs' },
    })
  })

  it('returns the data payload on success', async () => {
    const transport = transportWith((async () =>
      jsonResponse({ data: { shop: { name: 'Sentra' } } })) as unknown as typeof fetch)
    const result = await transport.request<{ shop: { name: string } }>(DOCUMENT)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.shop.name).toBe('Sentra')
  })

  it('reports the query cost to the observer', async () => {
    const costs: RequestCost[] = []
    const transport = transportWith(
      (async () =>
        jsonResponse({
          data: { shop: {} },
          extensions: { cost: COST },
        })) as unknown as typeof fetch,
      { onCost: (cost: RequestCost) => costs.push(cost) },
    )
    await transport.request(DOCUMENT)
    expect(costs).toEqual([COST])
  })

  it('tolerates a response with no cost extension', async () => {
    const costs: RequestCost[] = []
    const transport = transportWith(
      (async () => jsonResponse({ data: { shop: {} } })) as unknown as typeof fetch,
      { onCost: (cost: RequestCost) => costs.push(cost) },
    )
    const result = await transport.request(DOCUMENT)
    expect(result.ok).toBe(true)
    expect(costs).toEqual([])
  })

  it('converts an aborted request into a network error naming the timeout', async () => {
    const fetchImpl = (async (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })) as unknown as typeof fetch
    const transport = transportWith(fetchImpl, { timeoutMs: 5, maxAttempts: 1 })

    const result = await transport.request(DOCUMENT)
    const error = expectFailure(result)
    expect(error).toMatchObject({ kind: 'network' })
    expect(error.message).toContain('timed out after 5ms')
  })

  it('bounds the response body read by the same timeout, not just time-to-first-byte', async () => {
    /*
     * A hand-rolled `ReadableStream`-backed `Response` does not reliably
     * reject `.text()` on abort under Node's undici-backed `fetch`/`Response`
     * in this Vitest environment, so this fakes the object `fetchImpl`
     * resolves with directly: headers "arrive" immediately (the outer
     * `await fetchImpl(...)` resolves), but `.text()` only settles when the
     * timeout's `AbortSignal` fires — exactly the stalled-body scenario the
     * fix guards against. This exercises the real code path added in
     * `transport.ts` (the merged try block), not just unrelated behaviour:
     * without the fix, the timer is cleared before `.text()` is ever
     * awaited, so this fake `.text()` would hang forever and the test would
     * time out instead of resolving to a network error.
     */
    const fetchImpl = (async (_url: string, init: RequestInit) =>
      ({
        status: 200,
        ok: true,
        text: () =>
          new Promise<string>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            })
          }),
      }) as unknown as Response) as unknown as typeof fetch
    const transport = transportWith(fetchImpl, { timeoutMs: 5, maxAttempts: 1 })

    const result = await transport.request(DOCUMENT)
    const error = expectFailure(result)
    expect(error).toMatchObject({ kind: 'network' })
    expect(error.message).toContain('timed out after 5ms')
  })

  it('retries a transport failure up to maxAttempts and reports the count', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET')
    })
    const transport = transportWith(fetchImpl as unknown as typeof fetch, { maxAttempts: 3 })

    const result = await transport.request(DOCUMENT)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const error = expectFailure(result)
    expect(error).toMatchObject({ kind: 'network', attempts: 3 })
    expect(error.message).toContain('ECONNRESET')
  })

  it('succeeds on a retry after a transient failure', async () => {
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      if (calls === 1) throw new Error('ECONNRESET')
      return jsonResponse({ data: { shop: { name: 'Sentra' } } })
    }) as unknown as typeof fetch
    const transport = transportWith(fetchImpl)

    const result = await transport.request(DOCUMENT)
    expect(calls).toBe(2)
    expect(result.ok).toBe(true)
  })

  it('retries a 5xx response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503))
    const transport = transportWith(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 })

    const result = await transport.request(DOCUMENT)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(expectFailure(result)).toMatchObject({ kind: 'network', status: 503 })
  })

  it('does not retry a 4xx response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 401))
    const transport = transportWith(fetchImpl as unknown as typeof fetch, { maxAttempts: 3 })

    const result = await transport.request(DOCUMENT)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(expectFailure(result)).toMatchObject({ kind: 'network', status: 401, attempts: 1 })
  })

  it('treats HTTP 430 as throttling and retries it', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ extensions: { cost: { ...COST, throttleStatus: null } } }, 430),
    )
    const transport = transportWith(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 })

    const result = await transport.request(DOCUMENT)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(expectFailure(result)).toMatchObject({ kind: 'throttled' })
  })

  it('treats a THROTTLED graphql error as throttling and carries the budget', async () => {
    const throttleStatus = { maximumAvailable: 1000, currentlyAvailable: 3, restoreRate: 50 }
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
        extensions: { cost: { requestedQueryCost: 300, actualQueryCost: null, throttleStatus } },
      }),
    )
    const transport = transportWith(fetchImpl as unknown as typeof fetch, { maxAttempts: 2 })

    const result = await transport.request(DOCUMENT)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(expectFailure(result)).toMatchObject({ kind: 'throttled', throttleStatus })
  })

  it('maps other top-level graphql errors to a schema error', async () => {
    const transport = transportWith((async () =>
      jsonResponse({
        errors: [{ message: "Field 'nope' doesn't exist on type 'Product'" }],
      })) as unknown as typeof fetch)
    const result = await transport.request(DOCUMENT)
    const error = expectFailure(result)
    expect(error).toMatchObject({ kind: 'schema' })
    expect(error.message).toContain("Field 'nope'")
  })

  it('maps a null data payload to a schema error', async () => {
    const transport = transportWith((async () =>
      jsonResponse({ data: null })) as unknown as typeof fetch)
    const result = await transport.request(DOCUMENT)
    expect(expectFailure(result)).toMatchObject({ kind: 'schema', path: '$.data' })
  })

  it('maps an unparseable body to a schema error', async () => {
    const transport = transportWith(
      (async () =>
        new Response('<html>gateway</html>', { status: 200 })) as unknown as typeof fetch,
    )
    const result = await transport.request(DOCUMENT)
    const error = expectFailure(result)
    expect(error).toMatchObject({ kind: 'schema' })
    expect(error.message).toContain('not valid JSON')
  })

  it('waits between retries using the injected sleep', async () => {
    const delays: number[] = []
    let calls = 0
    const fetchImpl = (async () => {
      calls += 1
      if (calls < 3) throw new Error('ECONNRESET')
      return jsonResponse({ data: {} })
    }) as unknown as typeof fetch
    const transport = createStorefrontTransport({
      endpoint: ENDPOINT,
      token: 'public-token',
      fetchImpl,
      sleep: async (ms: number) => {
        delays.push(ms)
      },
    })

    await transport.request(DOCUMENT)
    expect(delays).toEqual([500, 1000])
  })
})

describe('retryDelayMs', () => {
  it('backs off exponentially with no throttle information', () => {
    expect(retryDelayMs(1, null, 0)).toBe(500)
    expect(retryDelayMs(2, null, 0)).toBe(1000)
    expect(retryDelayMs(3, null, 0)).toBe(2000)
  })

  it('caps the exponential backoff', () => {
    expect(retryDelayMs(9, null, 0)).toBe(4000)
  })

  it('waits long enough for the cost budget to refill', () => {
    /* Needs 300 points, has 50, refills at 50/s → 5 seconds. */
    const throttleStatus = { maximumAvailable: 1000, currentlyAvailable: 50, restoreRate: 50 }
    expect(retryDelayMs(1, throttleStatus, 300)).toBe(5000)
  })

  it('prefers plain backoff when the budget already covers the request', () => {
    const throttleStatus = { maximumAvailable: 1000, currentlyAvailable: 900, restoreRate: 50 }
    expect(retryDelayMs(1, throttleStatus, 300)).toBe(500)
  })

  it('falls back to backoff when the restore rate is unusable', () => {
    const throttleStatus = { maximumAvailable: 1000, currentlyAvailable: 0, restoreRate: 0 }
    expect(retryDelayMs(2, throttleStatus, 300)).toBe(1000)
  })
})
