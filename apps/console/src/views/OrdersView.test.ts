import { createFlagClient, type FlagClient, type FlagSource } from '@sentra/flags'
import { createI18n, i18nPlugin } from '@sentra/i18n'
import { analyticsPlugin, type Transport } from '@sentra/plugin-analytics'
import type { OpsClient } from '@sentra/sdk-ops'
import { uiMessages } from '@sentra/ui/i18n'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { consoleEventSchema } from '../analytics.ts'
import { CONSOLE_FLAGS } from '../flags.ts'
import { opsPlugin } from '../ops.ts'
import OrdersView from './OrdersView.vue'

/**
 * Matches `main.ts`'s install exactly: `uiMessages`, `locale: 'en'`, no
 * `onMissing`. One instance shared across the file — nothing here asserts on
 * a per-render i18n state.
 */
const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: uiMessages })

const PAGE = {
  orders: [
    {
      id: 'ord_1',
      reference: 'SEN-1042',
      placedAt: '2026-08-01T09:15:00.000Z',
      status: 'paid' as const,
      total: { amount: '149.00', currencyCode: 'IDR' },
      lineCount: 2,
    },
  ],
  nextCursor: 'cursor-1',
  totalCount: 37,
}

/** A client whose four methods are individually scriptable. */
function clientWith(overrides: Partial<OpsClient>): OpsClient {
  return {
    listOrders: vi.fn<OpsClient['listOrders']>(async () => ({ ok: true, value: PAGE })),
    getOrder: vi.fn<OpsClient['getOrder']>(async () => ({ ok: true, value: null })),
    listFlags: vi.fn<OpsClient['listFlags']>(async () => ({ ok: true, value: [] })),
    setFlag: vi.fn<OpsClient['setFlag']>(async () => ({
      ok: false,
      error: { kind: 'network', message: 'unused', status: null },
    })),
    ...overrides,
  }
}

/** A transport that discards every event — the view under test is not analytics. */
const stubTransport: Transport = { send: vi.fn() }

/**
 * Renders the view, optionally providing a flag client keyed by the
 * `'sentra:flags'` string (ADR 0005) via `global.provide` rather than
 * `global.plugins` — `app.use()` dedupes by plugin identity, so a
 * per-test `app.use(flagsPlugin, client)` on top of a globally-registered
 * one would silently no-op.
 */
function renderView(client: OpsClient, flagsClient?: FlagClient<string>) {
  return render(OrdersView, {
    global: {
      plugins: [
        [opsPlugin, client],
        [analyticsPlugin, { schema: consoleEventSchema, transport: stubTransport }],
        [i18nPlugin, i18n],
      ],
      provide: flagsClient ? { 'sentra:flags': flagsClient } : {},
    },
  })
}

describe('OrdersView', () => {
  it('renders the fetched orders', async () => {
    renderView(clientWith({}))
    expect(await screen.findByText('SEN-1042')).toBeTruthy()
  })

  it('reports the total count so the operator knows the page is partial', async () => {
    renderView(clientWith({}))
    expect(await screen.findByText(/37/)).toBeTruthy()
  })

  it('asks the server for the new order when the sort changes', async () => {
    const listOrders = vi.fn<OpsClient['listOrders']>(async () => ({ ok: true, value: PAGE }))
    renderView(clientWith({ listOrders }))
    await screen.findByText('SEN-1042')

    const header = await screen.findByRole('button', { name: /reference/i })
    header.click()

    await waitFor(() => {
      expect(listOrders).toHaveBeenCalledTimes(2)
    })
    /*
     * Not `cursor: undefined` — `listOrders`'s `cursor` param is optional
     * (`packages/sdk-ops/src/operations/orders.ts`) and `OrdersView.load()`
     * correctly omits the key entirely for a fresh sorted first page rather
     * than setting it to `undefined`; `toMatchObject` treats an absent key
     * and an explicit `undefined` value as distinct, so asserting the latter
     * here would fail against genuinely correct code.
     */
    expect(listOrders.mock.calls[1]?.[0]).toMatchObject({ sort: 'reference' })
    expect(listOrders.mock.calls[1]?.[0]).not.toHaveProperty('cursor')
  })

  it('announces the sort control by its translated name, not the catalogue key', async () => {
    renderView(clientWith({}))
    await screen.findByText('SEN-1042')

    expect(await screen.findByRole('button', { name: 'Sort by Reference' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'ui.dataTable.sortBy' })).toBeNull()
  })

  it('shows an error and keeps the previous rows when a refresh fails', async () => {
    const listOrders = vi
      .fn<OpsClient['listOrders']>(async () => ({ ok: true, value: PAGE }))
      .mockResolvedValueOnce({ ok: true, value: PAGE })
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: 'network', message: 'upstream responded 503', status: 503 },
      })
    renderView(clientWith({ listOrders }))
    await screen.findByText('SEN-1042')

    const header = await screen.findByRole('button', { name: /reference/i })
    header.click()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('SEN-1042')).toBeTruthy()
  })

  it('renders an auth failure as a distinct message, not a generic error', async () => {
    const listOrders = vi.fn<OpsClient['listOrders']>(async () => ({
      ok: false,
      error: { kind: 'auth', message: 'ops role required' },
    }))
    renderView(clientWith({ listOrders }))

    expect(await screen.findByText(/ops role required/i)).toBeTruthy()
  })

  /*
   * These three tests are split deliberately, not as two folded into one.
   * "Absent by default" names two different mechanisms — no client installed
   * (NULL_FLAGS, which answers `false` for every key with no declarations at
   * all) and a real client whose declared default is `false` — and a single
   * absence-assertion cannot tell which one made the UI disappear. Splitting
   * them means test 2 alone documents that the declaration is respected; see
   * the report for the deliberate-failure experiment that proves it.
   */
  describe('the orders.bulkActions gate', () => {
    it('is absent when no flag client is installed', async () => {
      renderView(clientWith({}))
      await screen.findByText('SEN-1042')

      expect(screen.queryByTestId('orders-bulk-actions')).toBeNull()
    })

    it('is absent for a real client with a declared-false default and a source that never resolves', async () => {
      const neverResolves: FlagSource = { load: () => new Promise(() => undefined) }
      const flags = createFlagClient({ declarations: CONSOLE_FLAGS, source: neverResolves })
      void flags.refresh()

      renderView(clientWith({}), flags)
      await screen.findByText('SEN-1042')

      expect(screen.queryByTestId('orders-bulk-actions')).toBeNull()
    })

    it('is present when the flag client reports the flag on', async () => {
      const onSource: FlagSource = { load: async () => ({ 'orders.bulkActions': true }) }
      const flags = createFlagClient({ declarations: CONSOLE_FLAGS, source: onSource })
      await flags.refresh()

      renderView(clientWith({}), flags)

      expect(await screen.findByTestId('orders-bulk-actions')).toBeTruthy()
    })
  })
})
