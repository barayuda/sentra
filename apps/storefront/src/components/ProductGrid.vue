<script setup lang="ts">
import { shopifyImageSrcset, shopifyImageUrl, type ProductSummary } from '@sentra/sdk-commerce'
import { ProductCard } from '@sentra/ui'
import { useElementSize } from '@vueuse/core'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, useTemplateRef, watch } from 'vue'

/**
 * Virtualised product grid.
 *
 * Two decisions worth reading before changing anything here:
 *
 * 1. **The virtualised item is a ROW, not a card.** A grid with three columns
 *    and 24 products has 8 rows; virtualising cards individually would require
 *    absolute positioning per card and re-deriving the layout the browser is
 *    already capable of doing inside a row.
 * 2. **Element-scoped `useVirtualizer`, not `useWindowVirtualizer`.** The same
 *    choice `DataTable` made: happy-dom reports zero-size rects for the window,
 *    so a window virtualiser renders nothing under test and the component's
 *    behaviour becomes unverifiable. An explicit `initialRect` on a scroll
 *    container keeps it honest.
 *
 * Images are requested from Shopify's CDN at the size actually needed, with a
 * `srcset` so a phone never downloads a 1200px rendition — the cheapest real
 * performance win available on a catalogue page.
 */
const props = withDefaults(
  defineProps<{
    /** Products loaded so far. */
    products: readonly ProductSummary[]
    /** Minimum card width; drives the responsive column count. */
    minCardWidthPx?: number
    /** Fixed row height, the virtualiser's size estimate. */
    rowHeightPx?: number
    /** Scroll viewport height. */
    heightPx?: number
  }>(),
  { minCardWidthPx: 240, rowHeightPx: 340, heightPx: 720 },
)

const emit = defineEmits<{
  /** A card was activated; carries the product handle. */
  select: [handle: string]
  /** The last row is visible — the caller should load the next page. */
  endReached: []
}>()

/** Candidate widths for the CDN `srcset`. */
const SRCSET_WIDTHS = [400, 600, 900] as const

const scrollRef = useTemplateRef<HTMLElement>('scroller')
const { width } = useElementSize(scrollRef)

/**
 * Columns that fit the current width.
 *
 * Derived from a measured width rather than a media query so the grid adapts to
 * its container — which is what makes it reusable inside a narrower shell
 * layout in M4 without re-tuning breakpoints.
 */
const columns = computed(() => {
  const available = width.value || props.minCardWidthPx * 3
  return Math.max(1, Math.floor(available / props.minCardWidthPx))
})

/** Products grouped into rows of `columns`. */
const rows = computed<readonly (readonly ProductSummary[])[]>(() => {
  const grouped: ProductSummary[][] = []
  for (let index = 0; index < props.products.length; index += columns.value) {
    grouped.push(props.products.slice(index, index + columns.value))
  }
  return grouped
})

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => props.rowHeightPx,
    overscan: 2,
    /** happy-dom reports zero-size rects; a real initial rect keeps tests honest. */
    initialRect: { width: props.minCardWidthPx * 3, height: props.heightPx },
  })),
)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalHeight = computed(() => virtualizer.value.getTotalSize())

/**
 * Fires `endReached` once the final row enters the rendered window.
 *
 * Watching the rendered window rather than a scroll offset means the trigger
 * also fires when the first page does not fill the viewport — otherwise a short
 * page would never load its successor and pagination would appear broken.
 */
watch(
  () => virtualRows.value.at(-1)?.index,
  (lastIndex) => {
    if (lastIndex === undefined || rows.value.length === 0) return
    if (lastIndex >= rows.value.length - 1) emit('endReached')
  },
  { immediate: true },
)
</script>

<template>
  <div
    ref="scroller"
    role="list"
    aria-label="Products"
    :aria-setsize="products.length"
    class="overflow-auto"
    :style="{ height: `${heightPx}px` }"
  >
    <div role="presentation" class="relative" :style="{ height: `${totalHeight}px` }">
      <div
        v-for="virtualRow in virtualRows"
        :key="String(virtualRow.key)"
        role="presentation"
        class="absolute inset-x-0 grid gap-4 px-1"
        :style="{
          top: `${virtualRow.start}px`,
          height: `${virtualRow.size}px`,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }"
      >
        <div
          v-for="product in rows[virtualRow.index]"
          :key="product.id"
          role="listitem"
          class="h-full"
        >
          <ProductCard
            :title="product.title"
            :price="{ amount: product.price.amount, currency: product.price.currencyCode }"
            :image-src="
              product.image ? shopifyImageUrl(product.image.url, { width: 600 }) : undefined
            "
            :image-alt="product.image?.altText ?? product.title"
            :image-srcset="
              product.image ? shopifyImageSrcset(product.image.url, SRCSET_WIDTHS) : undefined
            "
            :badge="product.availableForSale ? undefined : 'Sold out'"
            @select="emit('select', product.handle)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
