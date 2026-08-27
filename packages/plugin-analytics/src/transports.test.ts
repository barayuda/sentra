import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyticsEvent } from './events.ts'
import { batchTransport, beaconTransport, consoleTransport } from './transports.ts'

const event = (name: string): AnalyticsEvent => ({ name, timestamp: 1, props: {} })

describe('consoleTransport', () => {
  it('logs each batch', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    consoleTransport().send([event('a'), event('b')])
    expect(debug).toHaveBeenCalledOnce()
    debug.mockRestore()
  })
})

describe('beaconTransport', () => {
  it('posts the batch as JSON via sendBeacon', () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon })
    beaconTransport('/collect').send([event('a')])
    expect(sendBeacon).toHaveBeenCalledWith('/collect', expect.any(Blob))
    vi.unstubAllGlobals()
  })
})

describe('batchTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('buffers until maxSize, then forwards one combined batch', () => {
    const inner = { send: vi.fn() }
    const batched = batchTransport(inner, { maxSize: 3, flushMs: 60_000 })
    batched.send([event('a')])
    batched.send([event('b')])
    expect(inner.send).not.toHaveBeenCalled()
    batched.send([event('c')])
    expect(inner.send).toHaveBeenCalledWith([event('a'), event('b'), event('c')])
  })

  it('flushes on the timer', () => {
    const inner = { send: vi.fn() }
    const batched = batchTransport(inner, { maxSize: 100, flushMs: 5000 })
    batched.send([event('a')])
    vi.advanceTimersByTime(4999)
    expect(inner.send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(inner.send).toHaveBeenCalledWith([event('a')])
  })

  it('flushes explicitly and clears the buffer', () => {
    const inner = { send: vi.fn() }
    const batched = batchTransport(inner)
    batched.send([event('a')])
    batched.flush()
    expect(inner.send).toHaveBeenCalledWith([event('a')])
    batched.flush()
    expect(inner.send).toHaveBeenCalledOnce()
  })

  it('flushes on pagehide so tab closes lose nothing', () => {
    const inner = { send: vi.fn() }
    const batched = batchTransport(inner)
    batched.send([event('a')])
    window.dispatchEvent(new Event('pagehide'))
    expect(inner.send).toHaveBeenCalledWith([event('a')])
  })
})
