import { describe, expect, it, vi } from 'vitest'
import { createShellBus, NULL_BUS } from './bus.ts'

describe('createShellBus', () => {
  it('delivers a payload to every subscriber of that event', () => {
    const bus = createShellBus()
    const first = vi.fn()
    const second = vi.fn()
    bus.on('cart:updated', first)
    bus.on('cart:updated', second)

    bus.emit('cart:updated', { totalQuantity: 4 })

    expect(first).toHaveBeenCalledWith({ totalQuantity: 4 })
    expect(second).toHaveBeenCalledWith({ totalQuantity: 4 })
  })

  it('does not deliver across event names', () => {
    const bus = createShellBus()
    const handler = vi.fn()
    bus.on('session:changed', handler)

    bus.emit('cart:updated', { totalQuantity: 1 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('stops delivering after the returned unsubscribe is called', () => {
    const bus = createShellBus()
    const handler = vi.fn()
    const off = bus.on('cart:updated', handler)

    off()
    bus.emit('cart:updated', { totalQuantity: 1 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps delivering to the remaining handlers when one throws', () => {
    const bus = createShellBus()
    const survivor = vi.fn()
    bus.on('remote:failed', () => {
      throw new Error('subscriber exploded')
    })
    bus.on('remote:failed', survivor)

    expect(() => bus.emit('remote:failed', { name: 'console', reason: 'entry 404' })).not.toThrow()
    expect(survivor).toHaveBeenCalledWith({ name: 'console', reason: 'entry 404' })
  })

  it('is unaffected by a handler subscribing during delivery', () => {
    const bus = createShellBus()
    const late = vi.fn()
    bus.on('cart:updated', () => {
      bus.on('cart:updated', late)
    })

    bus.emit('cart:updated', { totalQuantity: 1 })

    expect(late).not.toHaveBeenCalled()
  })

  it('NULL_BUS accepts emits and returns a working unsubscribe', () => {
    const off = NULL_BUS.on('cart:updated', () => {
      throw new Error('NULL_BUS must never deliver')
    })
    expect(() => NULL_BUS.emit('cart:updated', { totalQuantity: 1 })).not.toThrow()
    expect(() => off()).not.toThrow()
  })
})
