import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import DataTableGeneric from './DataTable.vue'
import type { ColumnDef } from './columns.ts'

interface DemoRow {
  id: number
  sku: string
  name: string
  stock: number
}

/**
 * `DataTable.vue` is generic over its row type (`generic="Row extends { id:
 * string | number }"`); Storybook's `Meta`/`StoryObj` helpers need a
 * concrete component type to introspect props from, so this instantiates the
 * generic at `DemoRow` — a type-only application (a TS instantiation
 * expression) that keeps the exact same runtime component.
 */
const DataTable = DataTableGeneric<DemoRow>

const columns: ColumnDef<DemoRow>[] = [
  { key: 'sku', header: 'SKU', width: '8rem' },
  { key: 'name', header: 'Product', sortable: true },
  { key: 'stock', header: 'Stock', sortable: true },
]

const rows: DemoRow[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i,
  sku: `SKU-${String(i).padStart(5, '0')}`,
  name: `Product ${i}`,
  stock: (i * 37) % 500,
}))

/** Ten thousand rows, ~30 in the DOM: scroll and watch the count hold. */
const meta: Meta<typeof DataTable> = {
  title: 'Data/DataTable',
  /**
   * Vue compiles a generic `<script setup generic>` SFC's default export as
   * a bare call-signature function rather than a `DefineComponent` object,
   * so it structurally shares no property with Vue's `ConcreteComponent`
   * union (TS2559 weak-type detection) even though it is a fully valid
   * component at runtime. The cast targets exactly the type this field
   * expects rather than reaching for `any`, and only affects this
   * assignment — `Meta<typeof DataTable>` above still derives prop/arg
   * types from the real, uncast component type.
   */
  component: DataTable as unknown as Meta<typeof DataTable>['component'],
}

export default meta
type Story = StoryObj<typeof DataTable>

export const TenThousandRows: Story = {
  render: () => ({
    components: { DataTable },
    setup() {
      const sortKey = ref<string>()
      const sortDirection = ref<'asc' | 'desc'>()
      const sorted = ref(rows)
      function onSort(key: string, direction: 'asc' | 'desc') {
        sortKey.value = key
        sortDirection.value = direction
        sorted.value = [...rows].sort((a, b) => {
          const left = a[key as keyof DemoRow]
          const right = b[key as keyof DemoRow]
          const order = left < right ? -1 : left > right ? 1 : 0
          return direction === 'asc' ? order : -order
        })
      }
      return { columns, sorted, sortKey, sortDirection, onSort }
    },
    template: `
      <DataTable :columns="columns" :rows="sorted" :sort-key="sortKey"
        :sort-direction="sortDirection" @update:sort="onSort" />
    `,
  }),
}

export const Empty: Story = { args: { columns, rows: [] } }

export const Loading: Story = { args: { columns, rows: [], loading: true } }
