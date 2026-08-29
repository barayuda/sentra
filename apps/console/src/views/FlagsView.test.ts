import { analyticsPlugin, type Transport } from '@sentra/plugin-analytics'
import type { OpsClient } from '@sentra/sdk-ops'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { consoleEventSchema } from '../analytics.ts'
import { opsPlugin } from '../ops.ts'
import FlagsView from './FlagsView.vue'

const FLAG = {
  key: 'new-checkout',
  label: 'New checkout',
  enabled: false,
  updatedAt: '2026-08-20T04:00:00.000Z',
}

/** A client whose two flag methods are individually scriptable. */
function clientWith(overrides: Partial<OpsClient>): OpsClient {
  return {
    listOrders: vi.fn<OpsClient['listOrders']>(async () => ({
      ok: true,
      value: { orders: [], nextCursor: null, totalCount: 0 },
    })),
    getOrder: vi.fn<OpsClient['getOrder']>(async () => ({ ok: true, value: null })),
    listFlags: vi.fn<OpsClient['listFlags']>(async () => ({ ok: true, value: [FLAG] })),
    setFlag: vi.fn<OpsClient['setFlag']>(async () => ({
      ok: true,
      value: { ...FLAG, enabled: true },
    })),
    ...overrides,
  }
}

/** A transport that discards every event — the view under test is not analytics. */
const stubTransport: Transport = { send: vi.fn() }

function renderView(client: OpsClient) {
  return render(FlagsView, {
    global: {
      plugins: [
        [opsPlugin, client],
        [analyticsPlugin, { schema: consoleEventSchema, transport: stubTransport }],
      ],
    },
  })
}

describe('FlagsView', () => {
  it('lists the flags with their current state', async () => {
    renderView(clientWith({}))
    const toggle = await screen.findByRole('checkbox', { name: /new checkout/i })
    expect((toggle as HTMLInputElement).checked).toBe(false)
  })

  it('shows the new state immediately, before the server answers', async () => {
    let release: (result: Awaited<ReturnType<OpsClient['setFlag']>>) => void = () => undefined
    const setFlag = vi.fn<OpsClient['setFlag']>(
      () =>
        new Promise<Awaited<ReturnType<OpsClient['setFlag']>>>((resolve) => {
          release = resolve
        }),
    )
    renderView(clientWith({ setFlag }))
    const toggle = (await screen.findByRole('checkbox', {
      name: /new checkout/i,
    })) as HTMLInputElement

    toggle.click()

    /*
     * `toggle.click()` performs native activation, which flips the input's
     * `.checked` synchronously before any Vue handler runs — asserting on
     * `.checked` here would pass even if the component never touched its own
     * state. The label text is Vue-owned: it only reads "On" once
     * `flags.value` has actually moved, which is what an optimistic update
     * means. The write is still pending — `release` has not been called.
     */
    expect(await screen.findByText('On')).toBeTruthy()

    release({ ok: true, value: { ...FLAG, enabled: true } })
  })

  it('rolls the toggle back when the write fails', async () => {
    const setFlag = vi.fn<OpsClient['setFlag']>(async () => ({
      ok: false,
      error: { kind: 'validation', message: 'flag is locked by policy', field: 'enabled' },
    }))
    renderView(clientWith({ setFlag }))
    const toggle = (await screen.findByRole('checkbox', {
      name: /new checkout/i,
    })) as HTMLInputElement

    toggle.click()

    await waitFor(() => {
      expect(toggle.checked).toBe(false)
    })
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it("surfaces the server's reason, not a generic failure", async () => {
    const setFlag = vi.fn<OpsClient['setFlag']>(async () => ({
      ok: false,
      error: { kind: 'validation', message: 'flag is locked by policy', field: 'enabled' },
    }))
    renderView(clientWith({ setFlag }))
    const toggle = await screen.findByRole('checkbox', { name: /new checkout/i })

    toggle.click()

    expect(await screen.findByText(/locked by policy/i)).toBeTruthy()
  })
})
