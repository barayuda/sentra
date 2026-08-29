import type { FeatureFlag, OrderDetail, OrderStatus } from '../types.ts'

/** The base URL the mock service answers on. */
export const OPS_MOCK_BASE_URL = 'https://ops.sentra.test/api/v1'

/**
 * The token the mock service accepts.
 *
 * A fixed placeholder, not a credential, and named so that a reader and a
 * secret scanner both reach the same conclusion.
 */
export const MOCK_OPS_TOKEN = 'ops-mock-token-not-a-credential'

const STATUSES: readonly OrderStatus[] = ['pending', 'paid', 'fulfilled', 'refunded', 'cancelled']

const TITLES: readonly string[] = [
  'Stoneware Bowl',
  'Linen Napkin Set',
  'Cast Iron Skillet',
  'Ceramic Mug',
  'Olive Wood Board',
]

/**
 * Builds the fixture orders.
 *
 * Deterministic — index arithmetic, no randomness — so a failing assertion
 * names the same order on every run and a snapshot cannot drift.
 */
function buildOrders(): OrderDetail[] {
  return Array.from({ length: 37 }, (_unused, index) => {
    const lineCount = (index % 3) + 1
    const lines = Array.from({ length: lineCount }, (_line, lineIndex) => {
      const quantity = ((index + lineIndex) % 4) + 1
      const unit = 49 + lineIndex * 25
      return {
        id: `line_${index}_${lineIndex}`,
        title: TITLES[(index + lineIndex) % TITLES.length] ?? 'Stoneware Bowl',
        quantity,
        total: { amount: (unit * quantity).toFixed(2), currencyCode: 'IDR' },
      }
    })
    const total = lines.reduce((sum, line) => sum + Number(line.total.amount), 0)
    return {
      id: `ord_${index}`,
      reference: `SEN-${1000 + index}`,
      /* Fixed epoch minus a per-index offset: stable across runs and machines. */
      placedAt: new Date(Date.UTC(2026, 7, 1, 9, 0, 0) - index * 3_600_000).toISOString(),
      status: STATUSES[index % STATUSES.length] ?? 'paid',
      total: { amount: total.toFixed(2), currencyCode: 'IDR' },
      lineCount,
      /* Opaque by construction — an ops console has no business holding a name. */
      customerRef: `cus_${(index * 7919).toString(16).padStart(4, '0')}`,
      lines,
    }
  })
}

/** Every fixture order, newest first by construction. */
export const FIXTURE_ORDERS: readonly OrderDetail[] = buildOrders()

/**
 * The starting flag values.
 *
 * Kept separate from {@link FIXTURE_FLAGS} so {@link resetOpsMockFlags} has an
 * untouched copy to restore from — `FIXTURE_FLAGS` itself gets mutated in
 * place by the handlers.
 */
const SEED_FLAGS: readonly FeatureFlag[] = [
  {
    key: 'new-checkout',
    label: 'New checkout',
    enabled: false,
    updatedAt: '2026-08-20T04:00:00.000Z',
  },
  {
    key: 'bulk-refunds',
    label: 'Bulk refunds',
    enabled: true,
    updatedAt: '2026-08-18T11:30:00.000Z',
  },
  {
    key: 'live-inventory',
    label: 'Live inventory',
    enabled: true,
    updatedAt: '2026-08-12T02:05:00.000Z',
  },
  { key: 'export-csv', label: 'CSV export', enabled: false, updatedAt: '2026-07-30T08:45:00.000Z' },
]

/** The current flag set. Mutated by the handlers so a toggle persists within a session. */
export const FIXTURE_FLAGS: FeatureFlag[] = SEED_FLAGS.map((flag) => ({ ...flag }))

/**
 * Restores {@link FIXTURE_FLAGS} to its seed values, in place.
 *
 * `FIXTURE_FLAGS` is a `const` array the handlers mutate by index
 * (`FIXTURE_FLAGS[index] = updated`), so every other module holding a
 * reference to it sees the same mutation. Resetting therefore has to rewrite
 * the array's contents, the same array every importer already points at —
 * rebinding a local variable to a fresh array would leave that shared array
 * untouched and prove nothing. Mirrors `@sentra/sdk-commerce`'s
 * `resetMockStore`, which resets that package's mutable cart state the same
 * way for the same reason.
 */
export function resetOpsMockFlags(): void {
  SEED_FLAGS.forEach((flag, index) => {
    FIXTURE_FLAGS[index] = { ...flag }
  })
}
