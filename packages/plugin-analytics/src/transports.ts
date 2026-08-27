import type { AnalyticsEvent, Transport } from './events.ts'

/** Development transport: batches go to console.debug and nowhere else. */
export function consoleTransport(): Transport {
  return {
    send(events) {
      console.debug('[analytics]', events)
    },
  }
}

/**
 * Production transport using `navigator.sendBeacon`, which survives page
 * unloads that would cancel a fetch. Payload is a JSON Blob of the batch.
 */
export function beaconTransport(url: string): Transport {
  return {
    send(events) {
      const body = new Blob([JSON.stringify(events)], { type: 'application/json' })
      navigator.sendBeacon(url, body)
    },
  }
}

/**
 * Buffers events and forwards them to an inner transport when the buffer
 * reaches `maxSize`, when `flushMs` elapses after the first buffered event,
 * on explicit `flush()`, or on `pagehide` (so closing the tab loses
 * nothing). Decorator shape: wrap any other transport.
 */
export function batchTransport(
  inner: Transport,
  options: { maxSize?: number; flushMs?: number } = {},
): Transport & { flush(): void } {
  const { maxSize = 20, flushMs = 5000 } = options
  let buffer: AnalyticsEvent[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    if (buffer.length === 0) return
    const batch = buffer
    buffer = []
    inner.send(batch)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
  }

  return {
    flush,
    send(events) {
      buffer.push(...events)
      if (buffer.length >= maxSize) {
        flush()
        return
      }
      timer ??= setTimeout(flush, flushMs)
    },
  }
}
