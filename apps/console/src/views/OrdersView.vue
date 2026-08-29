<script setup lang="ts">
import { useAnalytics } from '@sentra/plugin-analytics'
import type { OpsError, OrderSortKey, OrderSummary, SortDirection } from '@sentra/sdk-ops'
import { DataTable, Money, type ColumnDef } from '@sentra/ui'
import { ref, shallowRef, watch } from 'vue'
import { useOps } from '../ops.ts'

const PAGE_SIZE = 20

const ops = useOps()
const analytics = useAnalytics()

const orders = shallowRef<readonly OrderSummary[]>([])
const totalCount = ref(0)
const error = shallowRef<OpsError | null>(null)
const loading = ref(false)
const sortKey = ref<OrderSortKey>('placedAt')
const sortDirection = ref<SortDirection>('desc')

/**
 * Invalidates in-flight loads.
 *
 * A sort change while a request is outstanding must not let the older
 * response write its rows over the newer ones — the displayed order would
 * then depend on network timing. Same guard as `useCollection` in
 * `@sentra/sdk-commerce`.
 */
let generation = 0

/** Fetches the first page for the current sort. */
async function load(): Promise<void> {
  const current = (generation += 1)
  loading.value = true
  const result = await ops.listOrders({
    limit: PAGE_SIZE,
    sort: sortKey.value,
    direction: sortDirection.value,
  })
  if (current !== generation) return
  loading.value = false
  if (!result.ok) {
    /* Stale rows stay: an operator troubleshooting an outage would rather see
       the last known orders under an error banner than an empty page. */
    error.value = result.error
    analytics.track('ops_error', { kind: result.error.kind })
    return
  }
  error.value = null
  orders.value = result.value.orders
  totalCount.value = result.value.totalCount
}

/**
 * Applies a new sort.
 *
 * @param key - Column to sort by.
 * @param direction - Direction to sort in.
 */
function onSort(key: string, direction: SortDirection): void {
  sortKey.value = key as OrderSortKey
  sortDirection.value = direction
  analytics.track('ops_order_sorted', { key, direction })
}

watch([sortKey, sortDirection], () => void load())
void load()

const columns: ColumnDef<OrderSummary>[] = [
  { key: 'reference', header: 'Reference', sortable: true, width: '10rem' },
  { key: 'placedAt', header: 'Placed', sortable: true, width: '14rem' },
  { key: 'status', header: 'Status', sortable: true, width: '9rem' },
  { key: 'total', header: 'Total', sortable: true, width: '10rem' },
  { key: 'lineCount', header: 'Lines', width: '6rem' },
]
</script>

<template>
  <section class="p-6">
    <header class="mb-4 flex items-baseline justify-between">
      <h1 class="text-xl font-semibold">Orders</h1>
      <p class="text-sm text-slate-500">Showing {{ orders.length }} of {{ totalCount }}</p>
    </header>

    <p
      v-if="error"
      role="alert"
      class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      {{ error.message }}
    </p>

    <DataTable
      :columns="columns"
      :rows="orders"
      :loading="loading"
      :sort-key="sortKey"
      :sort-direction="sortDirection"
      label="Orders"
      @update:sort="onSort"
    >
      <template #cell-total="{ row }">
        <Money :amount="row.total.amount" :currency="row.total.currencyCode" />
      </template>
    </DataTable>
  </section>
</template>
