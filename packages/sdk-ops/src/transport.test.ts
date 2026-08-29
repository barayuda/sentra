import { describe, expect, it, vi } from 'vitest'
import { createOpsTransport } from './transport.ts'

const BASE_URL = 'https://ops.sentra.test/api/v1'
/** Not a credential — a fixed string the mock service accepts. */
const TOKEN = 'ops-mock-token-not-a-credential'

/** Builds a transport whose fetch is scripted, so no test touches a socket. */
function transportWith(responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = []
  let index = 0
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    const next = responses[Math.min(index, responses.length - 1)]
    index += 1
    if (next instanceof Error) throw next
    if (!next) throw new Error('no scripted response')
    return next
  })
  const transport = createOpsTransport({
    baseUrl: BASE_URL,
    token: TOKEN,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async () => undefined,
  })
  return { transport, calls, fetchImpl }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createOpsTransport', () => {
  it('sends the bearer token and returns the decoded body', async () => {
    const { transport, calls } = transportWith([json({ orders: [] })])

    const result = await transport.request<{ orders: unknown[] }>('GET', '/orders')

    expect(result).toEqual({ ok: true, value: { orders: [] } })
    expect(calls[0]?.url).toBe(`${BASE_URL}/orders`)
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('serialises a body and sets the content type', async () => {
    const { transport, calls } = transportWith([json({ ok: true })])

    await transport.request('PATCH', '/flags/new-checkout', { enabled: true })

    expect(calls[0]?.init.method).toBe('PATCH')
    expect(calls[0]?.init.body).toBe('{"enabled":true}')
    expect((calls[0]?.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
  })

  it('maps 401 to an auth error and does not retry', async () => {
    const { transport, fetchImpl } = transportWith([json({ message: 'token rejected' }, 401)])

    const result = await transport.request('GET', '/orders')

    expect(result).toEqual({ ok: false, error: { kind: 'auth', message: 'token rejected' } })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('maps 403 to an auth error', async () => {
    const { transport } = transportWith([json({ message: 'ops role required' }, 403)])
    const result = await transport.request('GET', '/orders')
    if (result.ok) throw new Error('expected failure')
    expect(result.error.kind).toBe('auth')
  })

  it('maps 422 to a validation error carrying the field', async () => {
    const { transport } = transportWith([json({ message: 'unknown flag', field: 'key' }, 422)])

    const result = await transport.request('PATCH', '/flags/nope', { enabled: true })

    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', message: 'unknown flag', field: 'key' },
    })
  })

  it('retries a 500 and succeeds on the second attempt', async () => {
    const { transport, fetchImpl } = transportWith([
      json({ message: 'boom' }, 500),
      json({ ok: 1 }),
    ])

    const result = await transport.request<{ ok: number }>('GET', '/orders')

    expect(result).toEqual({ ok: true, value: { ok: 1 } })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('gives up after maxAttempts and reports the last failure', async () => {
    const { transport, fetchImpl } = transportWith([json({ message: 'boom' }, 503)])

    const result = await transport.request('GET', '/orders')

    if (result.ok) throw new Error('expected failure')
    expect(result.error.kind).toBe('network')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('reports a body that is not JSON as a schema error', async () => {
    const { transport } = transportWith([new Response('<html>gateway</html>', { status: 200 })])

    const result = await transport.request('GET', '/orders')

    if (result.ok) throw new Error('expected failure')
    expect(result.error.kind).toBe('schema')
  })

  it('reports an aborted request as a network failure naming the timeout', async () => {
    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    const { transport } = transportWith([abort])

    const result = await transport.request('GET', '/orders')

    if (result.ok) throw new Error('expected failure')
    expect(result.error.kind).toBe('network')
    expect(result.error.message).toContain('timed out')
  })

  it('never puts the token in an error message', async () => {
    const { transport } = transportWith([json({ message: `rejected ${TOKEN}` }, 401)])
    const result = await transport.request('GET', '/orders')
    if (result.ok) throw new Error('expected failure')
    expect(result.error.message).not.toContain(TOKEN)
  })
})
