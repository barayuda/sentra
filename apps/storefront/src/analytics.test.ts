import { createAnalytics, type AnalyticsEvent, type Transport } from '@sentra/plugin-analytics'
import { describe, expect, it, vi } from 'vitest'
import { storefrontEventSchema } from './analytics.ts'

/** Collects everything a transport receives. */
function recordingTransport(): Transport & { events: AnalyticsEvent[] } {
  const events: AnalyticsEvent[] = []
  return { events, send: (batch) => events.push(...batch) }
}

describe('storefrontEventSchema', () => {
  it('declares every event the application tracks', () => {
    expect(Object.keys(storefrontEventSchema).sort()).toEqual([
      'add_to_cart',
      'cart_open',
      'page_view',
      'product_view',
      'remove_from_cart',
      'storefront_error',
      'web_vital',
    ])
  })

  it('allows page_view the fields instrumentRouter sends', () => {
    expect(storefrontEventSchema.page_view).toEqual(['path', 'name'])
  })

  it('allows web_vital the fields captureWebVitals sends', () => {
    expect(storefrontEventSchema.web_vital).toEqual(['metric', 'value', 'rating'])
  })

  it('does not allow merchant-authored content through any event', () => {
    /* Product titles and descriptions are merchant content: unbounded in size
       and outside our control. Handles and ids identify a product without
       forwarding its copy. */
    const forbidden = ['title', 'description', 'descriptionHtml', 'email', 'query']
    for (const [event, allowed] of Object.entries(storefrontEventSchema)) {
      for (const field of forbidden) {
        expect(allowed, `${event} must not allow ${field}`).not.toContain(field)
      }
    }
  })

  it('strips a field that is not on an event allowlist', () => {
    const transport = recordingTransport()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const analytics = createAnalytics({ schema: storefrontEventSchema, transport })

    analytics.track('product_view', { handle: 'sentra-piece-1', title: 'leaked' })

    expect(transport.events[0]?.props).toEqual({ handle: 'sentra-piece-1' })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
