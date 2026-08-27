import { describe, expect, it, vi } from 'vitest'
import { createAnalytics } from './events.ts'
import { captureWebVitals, type VitalsReporters } from './vitals.ts'

describe('captureWebVitals', () => {
  it('reports each metric through the analytics pipeline', () => {
    const send = vi.fn()
    const client = createAnalytics({
      schema: { web_vital: ['metric', 'value', 'rating'] },
      transport: { send },
    })
    /** Fake reporters invoke the callback synchronously with a canned metric. */
    const reporters: VitalsReporters = {
      onLCP: (cb) => cb({ name: 'LCP', value: 1200.5, rating: 'good' }),
      onINP: (cb) => cb({ name: 'INP', value: 180, rating: 'needs-improvement' }),
      onCLS: (cb) => cb({ name: 'CLS', value: 0.02, rating: 'good' }),
    }
    captureWebVitals(client, reporters)
    expect(send).toHaveBeenCalledTimes(3)
    expect(send).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'web_vital',
        props: { metric: 'LCP', value: 1200.5, rating: 'good' },
      }),
    ])
  })
})
