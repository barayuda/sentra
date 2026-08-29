<script setup lang="ts" generic="Row extends { id: string | number }">
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, useTemplateRef } from 'vue'
import type { ColumnDef } from './columns.ts'

/**
 * Virtualised data table. Renders only the rows intersecting the viewport
 * (plus overscan), so ten thousand rows cost what thirty cost.
 *
 * Semantics: virtualisation removes off-screen rows from the DOM, which
 * would corrupt native `<table>` behaviour — so the markup is a div
 * structure carrying explicit table roles, with `aria-rowcount` advertising
 * the true total the DOM no longer shows.
 *
 * The scroll viewport carries `role="rowgroup"` (not a bare div) so the
 * `role="row"` elements it contains remain valid children of the outer
 * `role="table"` per the ARIA table ownership chain; its own sizing spacer
 * carries `role="presentation"` so that wrapper stays transparent in the
 * same chain. The viewport also carries `tabindex="0"`, per WCAG technique
 * G202, so keyboard users can focus and scroll it — both were flagged by
 * the CI a11y gate (aria-required-children, scrollable-region-focusable).
 *
 * Sorting is controlled: clicking a sortable header emits `update:sort`; the
 * parent reorders `rows` and reflects the state back through `sortKey` /
 * `sortDirection`. The table never mutates data it does not own.
 */
const props = withDefaults(
  defineProps<{
    /** Typed column contract; order defines display order. */
    columns: ColumnDef<Row>[]
    /** Row data. Each row needs a stable `id` for keying. */
    rows: Row[]
    /** Fixed row height in pixels — the virtualiser's size estimate. */
    rowHeightPx?: number
    /** Scroll viewport height in pixels. */
    heightPx?: number
    /** Marks the table busy (skeleton state is the consumer's story). */
    loading?: boolean
    /** Currently sorted column key (controlled). */
    sortKey?: string
    /** Current sort direction (controlled). */
    sortDirection?: 'asc' | 'desc'
    /**
     * Accessible name for the table and its scrollable region. The scroll
     * viewport is focusable (WCAG 2.1.1 for keyboard scrolling), and a
     * focusable region with no name is announced as an unlabelled group.
     */
    label?: string
  }>(),
  {
    rowHeightPx: 44,
    heightPx: 400,
    loading: false,
    sortKey: undefined,
    sortDirection: undefined,
    label: 'Data table',
  },
)

const emit = defineEmits<{
  /** Sort request: the column key and the direction the user asked for. */
  'update:sort': [key: string, direction: 'asc' | 'desc']
}>()

const scrollRef = useTemplateRef<HTMLElement>('scroller')

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.rows.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => props.rowHeightPx,
    overscan: 5,
    /** happy-dom reports zero-size rects; a real initial rect keeps tests honest. */
    initialRect: { width: 800, height: props.heightPx },
  })),
)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalHeight = computed(() => virtualizer.value.getTotalSize())

function ariaSort(column: ColumnDef<Row>): 'ascending' | 'descending' | undefined {
  if (props.sortKey !== column.key || !props.sortDirection) return undefined
  return props.sortDirection === 'asc' ? 'ascending' : 'descending'
}

function requestSort(column: ColumnDef<Row>): void {
  const next: 'asc' | 'desc' =
    props.sortKey === column.key && props.sortDirection === 'asc' ? 'desc' : 'asc'
  emit('update:sort', column.key, next)
}

function cellValue(row: Row, column: ColumnDef<Row>): unknown {
  return column.accessor ? column.accessor(row) : (row as Record<string, unknown>)[column.key]
}
</script>

<template>
  <div
    role="table"
    :aria-label="label"
    :aria-rowcount="rows.length + 1"
    :aria-busy="loading || undefined"
    class="overflow-hidden rounded-lg border border-neutral-300"
  >
    <div role="row" class="flex border-b border-neutral-300 bg-neutral-100">
      <div
        v-for="column in columns"
        :key="column.key"
        role="columnheader"
        :aria-sort="ariaSort(column)"
        class="flex-1 px-3 py-2 text-left text-sm font-semibold text-neutral-700"
        :style="column.width ? { flex: `0 0 ${column.width}` } : undefined"
      >
        <button
          v-if="column.sortable"
          type="button"
          class="inline-flex items-center gap-1"
          :aria-label="`Sort by ${column.header}`"
          @click="requestSort(column)"
        >
          {{ column.header }}
          <span aria-hidden="true">{{
            ariaSort(column) === 'ascending' ? '▲' : ariaSort(column) === 'descending' ? '▼' : '↕'
          }}</span>
        </button>
        <template v-else>{{ column.header }}</template>
      </div>
    </div>

    <div v-if="rows.length === 0" class="px-3 py-8 text-center text-sm text-neutral-500">
      <slot name="empty">No rows to display.</slot>
    </div>

    <div
      v-else
      ref="scroller"
      role="rowgroup"
      tabindex="0"
      :aria-label="`${label} rows, scrollable`"
      class="overflow-auto"
      :style="{ height: `${heightPx}px` }"
    >
      <div role="presentation" class="relative" :style="{ height: `${totalHeight}px` }">
        <div
          v-for="virtualRow in virtualRows"
          :key="rows[virtualRow.index]!.id"
          role="row"
          :aria-rowindex="virtualRow.index + 2"
          class="absolute inset-x-0 flex items-center border-b border-neutral-200"
          :style="{ height: `${rowHeightPx}px`, transform: `translateY(${virtualRow.start}px)` }"
        >
          <div
            v-for="column in columns"
            :key="column.key"
            role="cell"
            class="flex-1 truncate px-3 text-sm text-neutral-700"
            :style="column.width ? { flex: `0 0 ${column.width}` } : undefined"
          >
            <slot
              :name="`cell-${column.key}`"
              :row="rows[virtualRow.index]!"
              :value="cellValue(rows[virtualRow.index]!, column)"
            >
              {{ cellValue(rows[virtualRow.index]!, column) }}
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
