import { describe, expect, it, vi } from 'vitest'
import { createAnalytics, type AnalyticsEvent, type Transport } from './events.ts'

function captureTransport(): Transport & { events: AnalyticsEvent[] } {
  const events: AnalyticsEvent[] = []
  return {
    events,
    send(batch) {
      events.push(...batch)
    },
  }
}

const schema = {
  page_view: ['path', 'title'],
  cta_click: ['id'],
} as const

describe('createAnalytics', () => {
  it('sends a schema-listed event with its timestamp', () => {
    const transport = captureTransport()
    const client = createAnalytics({ schema, transport, now: () => 1234 })
    client.track('cta_click', { id: 'buy' })
    expect(transport.events).toEqual([{ name: 'cta_click', timestamp: 1234, props: { id: 'buy' } }])
  })

  it('drops an event whose name is not in the schema, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const transport = captureTransport()
    const client = createAnalytics({ schema, transport })
    client.track('rogue_event', { anything: 1 })
    expect(transport.events).toHaveLength(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rogue_event'))
    warn.mockRestore()
  })

  it('strips props the allowlist does not name (the PII control)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const transport = captureTransport()
    const client = createAnalytics({ schema, transport })
    client.track('page_view', { path: '/checkout', email: 'x@example.com' })
    expect(transport.events[0]?.props).toEqual({ path: '/checkout' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('email'))
    warn.mockRestore()
  })

  it('sends an event with no props as an empty object', () => {
    const transport = captureTransport()
    const client = createAnalytics({ schema, transport })
    client.track('cta_click')
    expect(transport.events[0]?.props).toEqual({})
  })

  it('flush() delegates to a flushable transport and is a no-op otherwise', () => {
    const flush = vi.fn()
    const transport = { send: vi.fn(), flush }
    const client = createAnalytics({ schema, transport })
    client.flush()
    expect(flush).toHaveBeenCalledOnce()
    const plain = captureTransport()
    expect(() => createAnalytics({ schema, transport: plain }).flush()).not.toThrow()
  })
})
