import { render, screen, fireEvent } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import DataTable from './DataTable.vue'
import type { ColumnDef } from './columns.ts'

interface Product {
  id: number
  name: string
  price: number
}

const columns: ColumnDef<Product>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'price', header: 'Price', accessor: (row) => `$${row.price}` },
]

const manyRows: Product[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: `Product ${i}`,
  price: i,
}))

describe('DataTable', () => {
  it('renders column headers', () => {
    render(DataTable, { props: { columns, rows: manyRows.slice(0, 3) } })
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Price' })).toBeTruthy()
  })

  it('virtualises: renders far fewer rows than it advertises', () => {
    render(DataTable, { props: { columns, rows: manyRows, heightPx: 400, rowHeightPx: 40 } })
    const table = screen.getByRole('table')
    expect(table.getAttribute('aria-rowcount')).toBe('1001')
    const rendered = screen.getAllByRole('row').length
    expect(rendered).toBeGreaterThan(1)
    expect(rendered).toBeLessThan(60)
  })

  it('applies column accessors', () => {
    render(DataTable, { props: { columns, rows: manyRows.slice(0, 2) } })
    expect(screen.getByText('$1')).toBeTruthy()
  })

  it('renders scoped cell slots over accessors', () => {
    render(DataTable, {
      props: { columns, rows: manyRows.slice(0, 1) },
      slots: {
        'cell-name': ({ row }: { row: Product }) => h('strong', `NAME:${row.name}`),
      },
    })
    expect(screen.getByText('NAME:Product 0')).toBeTruthy()
  })

  it('shows the empty slot when there are no rows', () => {
    render(DataTable, {
      props: { columns, rows: [] },
      slots: { empty: 'Nothing to show' },
    })
    expect(screen.getByText('Nothing to show')).toBeTruthy()
  })

  it('marks the table busy while loading', () => {
    render(DataTable, { props: { columns, rows: [], loading: true } })
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true')
  })

  it('emits a sort request from a sortable header, toggling direction', async () => {
    const { emitted, rerender } = render(DataTable, {
      props: { columns, rows: manyRows.slice(0, 3) },
    })
    await fireEvent.click(screen.getByRole('button', { name: /sort by name/i }))
    expect(emitted('update:sort')).toEqual([['name', 'asc']])
    await rerender({ columns, rows: manyRows.slice(0, 3), sortKey: 'name', sortDirection: 'asc' })
    await fireEvent.click(screen.getByRole('button', { name: /sort by name/i }))
    expect(emitted('update:sort')[1]).toEqual(['name', 'desc'])
  })

  it('reflects the controlled sort state via aria-sort', () => {
    render(DataTable, {
      props: { columns, rows: [], sortKey: 'name', sortDirection: 'desc' },
    })
    expect(screen.getByRole('columnheader', { name: /name/i }).getAttribute('aria-sort')).toBe(
      'descending',
    )
  })

  it('gives non-sortable headers no sort button', () => {
    render(DataTable, { props: { columns, rows: [] } })
    expect(screen.queryByRole('button', { name: /sort by price/i })).toBeNull()
  })

  it('labels the table and its scrollable region for assistive technology', () => {
    const { getByRole } = render(DataTable, {
      props: { columns, rows: manyRows.slice(0, 3), label: 'Orders' },
    })
    expect(getByRole('table').getAttribute('aria-label')).toBe('Orders')
    const scroller = getByRole('table').querySelector('[tabindex="0"]')
    expect(scroller?.getAttribute('aria-label')).toBe('Orders rows, scrollable')
  })

  /**
   * `rows` is typed `readonly Row[]` precisely so a caller holding its data
   * behind a `shallowRef<readonly Row[]>` — the shape a server-shaped query
   * naturally produces, e.g. the console's `OrdersView` — can pass it straight
   * through without copying. A frozen array is the runtime proof: if any
   * internal path ever tried to mutate `rows` (sort in place, push, splice),
   * this would throw instead of silently succeeding.
   */
  it('accepts a readonly (frozen) rows array without mutating it', () => {
    const frozenRows: readonly Product[] = Object.freeze(manyRows.slice(0, 3))
    render(DataTable, { props: { columns, rows: frozenRows } })
    expect(screen.getByText('Product 0')).toBeTruthy()
  })

  /**
   * A server-shaped consumer mounts this component with `rows: []` (nothing
   * has loaded yet) and populates it once a request resolves — the console's
   * `OrdersView` does exactly this. Without the `offsetHeight`/`offsetWidth`
   * stub in `vitest.setup.ts`, happy-dom's hardcoded zero-size measurement
   * permanently overwrites the virtualizer's `initialRect` seed and this test
   * renders no rows at all; see that file's doc comment for the root cause.
   */
  it('renders rows that arrive after mount, not just rows present at mount', async () => {
    const { rerender } = render(DataTable, { props: { columns, rows: [] } })
    await rerender({ columns, rows: manyRows.slice(0, 1) })
    expect(await screen.findByText('Product 0')).toBeTruthy()
  })
})
