import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpSource, staticSource } from './sources.ts'

const context = { stableId: 'user-1' }

describe('staticSource', () => {
  it('resolves the given values unchanged', async () => {
    const values = { 'checkout.express': true, 'search.instant': 42 }
    const source = staticSource(values)
    await expect(source.load(context)).resolves.toEqual(values)
  })
})

describe('httpSource', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves the JSON body on a successful response', async () => {
    const body = { 'checkout.express': true }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)

    const values = await httpSource('/flags').load(context)

    expect(values).toEqual(body)
    expect(fetchImpl).toHaveBeenCalledWith('/flags')
  })

  it('throws when the response is not ok, instead of resolving a parsed error body', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
    )
    vi.stubGlobal('fetch', fetchImpl)

    await expect(httpSource('/flags').load(context)).rejects.toThrow('500')
  })

  /*
   * I1: the thrown message must never embed the request URL — a token-bearing
   * flags endpoint would otherwise put a credential one hop from
   * `createFlagClient`'s `onError` sink. Mirrors
   * `apps/console/src/flags.test.ts:225-253`'s assertion style for
   * `createOpsFlagSource`. The URL below uses a placeholder host and a
   * placeholder token-shaped path segment — never a real-looking credential.
   */
  it('does not embed the request URL — including a path-segment token — in the thrown message', async () => {
    const url = 'https://flags.example/v1/token/placeholder-token-abc123/flags'
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetchImpl)

    let thrown: unknown
    try {
      await httpSource(url).load(context)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Error)
    const message = (thrown as Error).message
    expect(message).not.toContain('flags.example')
    expect(message).not.toContain('placeholder-token-abc123')
    expect(message).toContain('503')
  })

  it('propagates a network-level rejection', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', fetchImpl)

    await expect(httpSource('/flags').load(context)).rejects.toThrow('network down')
  })
})
