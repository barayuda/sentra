# @sentra/plugin-analytics

## What it does

Schema-validated, allowlist-only analytics as a genuine Vue plugin — installed with
`app.use(analyticsPlugin, options)`, not bolted on as a side-loaded script. The schema
**is** the PII control: a field not named in the schema never leaves the page, no matter
what a call site passes. `track()` drops unknown event names entirely and strips unknown
prop keys, each with a console warning, so the mistake is visible in development instead
of silently shipping data.

Web Vitals reporting shares this same pipeline rather than a separate one: Core Web
Vitals become `web_vital` events, validated by the same schema and sent through the same
transport as behavioural events — behaviour and performance share one pipeline.

## How to use it

Install the plugin with a schema and a transport:

```ts
import { analyticsPlugin, batchTransport, beaconTransport } from '@sentra/plugin-analytics'

app.use(analyticsPlugin, {
  schema: {
    page_view: ['path', 'name'],
    cta_click: ['id'],
    web_vital: ['metric', 'value', 'rating'],
  },
  transport: batchTransport(beaconTransport('/collect')),
})
```

`beaconTransport` sends via `navigator.sendBeacon`, which survives page unloads that
would cancel a fetch. `batchTransport` wraps it (or any transport) to buffer events by
count, by a flush interval, or on `pagehide`, so closing the tab loses nothing buffered.

From there:

- `useAnalytics()` returns the installed client — `useAnalytics().track('cta_click', { id: 'hero-cta' })`.
- The `v-track` directive is registered on install and tracks declaratively —
  `v-track="{ name: 'cta_click', props: { id: 'hero-cta' } }"` tracks on click;
  `v-track:submit="{ name: 'form_submit' }"` tracks the `submit` event instead.
- `instrumentRouter(router, useAnalytics())` tracks a `page_view` on every completed
  navigation (requires `page_view: ['path', 'name']` in the schema).
- `captureWebVitals(useAnalytics())` reports LCP, INP, and CLS as `web_vital` events —
  behaviour and performance share one pipeline.

## What it depends on

- `web-vitals` — runtime dependency; the source `captureWebVitals` wraps.
- `vue` — peer dependency (`^3.5.0`).
- `vue-router` — optional peer dependency. `instrumentRouter` is the only export that
  touches it, so router integration is opt-in and tree-shakes away for consumers that
  never call it.
