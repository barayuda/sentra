import { useFlags } from '@sentra/flags'
import { createShellBus } from '@sentra/shell-contract'
import { flushPromises } from '@vue/test-utils'
import { createApp } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerConsole } from './register.ts'

/**
 * `registerConsole` builds its ops client via `createConsoleOpsClient()`
 * (`../ops.ts`), a real `@sentra/sdk-ops` client pointed at
 * `OPS_MOCK_BASE_URL`. Stubbing `fetch` — the one seam the real transport
 * bottoms out at (`packages/sdk-ops/src/transport.ts:106`) — lets this test
 * drive `registerConsole`'s actual wiring end to end: real ops client, real
 * `createOpsFlagSource`, real `createFlagClient`, real `flagsPlugin`. Stubbing
 * `@sentra/flags` itself, or the ops client, would reproduce the exact
 * blindness (C1) this test exists to close — every existing test in this
 * package constructs a flag client directly and never exercises this
 * federated registration path at all.
 */
function stubFlagsEndpoint(flags: readonly { key: string; enabled: boolean }[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (!url.endsWith('/flags')) return new Response('not found', { status: 404 })
      const body = {
        flags: flags.map((flag) => ({
          key: flag.key,
          label: flag.key,
          enabled: flag.enabled,
          updatedAt: '2026-01-01',
        })),
      }
      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registerConsole', () => {
  it('wires a flag client so orders.bulkActions resolves through the shell-shaped host, not NULL_FLAGS', async () => {
    stubFlagsEndpoint([{ key: 'orders.bulkActions', enabled: true }])

    const app = createApp({})
    const bus = createShellBus()
    registerConsole(app, { bus, basePath: '' })

    /*
     * `registerConsole` calls `void flags.refresh()` fire-and-forget, the same
     * way `main.ts:141` does. `flushPromises` drains the microtask chain
     * behind it: `source.load` -> the ops client's `listFlags` -> the
     * transport's stubbed `fetch` -> `response.text()` -> `JSON.parse`.
     */
    await flushPromises()

    const flags = app.runWithContext(() => useFlags<'orders.bulkActions'>())

    /*
     * `NULL_FLAGS.isOn()` (`packages/flags/src/vue.ts:22-30`) can never return
     * `true` for any key — it is a hardcoded `false`. Asserting `true` here is
     * therefore the strongest available proof that `useFlags()` resolved a
     * real, installed client rather than the `inject()` fallback: no
     * unmodified NULL-fallback path could ever make this assertion pass.
     */
    expect(flags.isOn('orders.bulkActions')).toBe(true)
  })
})
