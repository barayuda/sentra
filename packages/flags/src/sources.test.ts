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

  it('propagates a network-level rejection', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', fetchImpl)

    await expect(httpSource('/flags').load(context)).rejects.toThrow('network down')
  })
})
