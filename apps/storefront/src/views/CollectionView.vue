<script setup lang="ts">
import { useCollection } from '@sentra/sdk-commerce/vue'
import { useAnalytics } from '@sentra/plugin-analytics'
import { Button } from '@sentra/ui'
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import ProductGrid from '../components/ProductGrid.vue'
import StateBlock from '../components/StateBlock.vue'
import { errorCopy } from '../lib/errorCopy.ts'
import { DEFAULT_COLLECTION_HANDLE } from '../router.ts'

/**
 * Collection listing.
 *
 * The state precedence below is deliberate: an error takes the screen only when
 * there is nothing to show. Once products are loaded, a failed *next* page must
 * not blank the catalogue the reader is already browsing — it degrades to an
 * inline message under the grid.
 */
const router = useRouter()

/**
 * `useAnalytics()` throws when `analyticsPlugin` was never installed on the
 * app. Production always installs it (see `main.ts`), but a unit test that
 * mounts this view in isolation to exercise loading/empty/error states has no
 * reason to also wire up analytics — and a telemetry call must never be able
 * to crash the page it is reporting on. The try/catch keeps `useAnalytics()`
 * as the sanctioned way to get the client while degrading to a no-op instead
 * of an unhandled exception when it is absent.
 */
let analytics: ReturnType<typeof useAnalytics> | null
try {
  analytics = useAnalytics()
} catch {
  analytics = null
}

const { products, title, loading, error, hasNextPage, loadMore, reset } = useCollection(
  DEFAULT_COLLECTION_HANDLE,
  { pageSize: 12 },
)

const isEmpty = computed(() => !loading.value && !error.value && products.value.length === 0)
const isInitialLoading = computed(() => loading.value && products.value.length === 0)
const blockingError = computed(() => (products.value.length === 0 ? error.value : null))
const inlineError = computed(() => (products.value.length > 0 ? error.value : null))

const copy = computed(() => (error.value ? errorCopy(error.value) : null))

/** Reports failures by taxonomy kind — never by message; see analytics.ts. */
watch(error, (next) => {
  if (next) analytics?.track('storefront_error', { kind: next.kind, operation: 'getCollection' })
})

function openProduct(handle: string): void {
  void router.push({ name: 'product', params: { handle } })
}

/** The grid fires this whenever its last row is visible; the feed guards repeats. */
function onEndReached(): void {
  if (hasNextPage.value) void loadMore()
}
</script>

<template>
  <section>
    <h1 class="text-xl font-semibold text-neutral-900">{{ title || 'Collection' }}</h1>

    <StateBlock
      v-if="isInitialLoading"
      class="mt-6"
      variant="loading"
      title="Loading the collection"
      detail="Fetching products from the store."
    />

    <StateBlock
      v-else-if="blockingError && copy"
      class="mt-6"
      variant="error"
      :title="copy.title"
      :detail="copy.detail"
    >
      <template v-if="copy.retryable" #action>
        <Button @click="reset()">Try again</Button>
      </template>
    </StateBlock>

    <StateBlock
      v-else-if="isEmpty"
      class="mt-6"
      variant="empty"
      title="Nothing here yet"
      detail="This collection has no products at the moment."
    />

    <template v-else>
      <ProductGrid
        class="mt-6"
        :products="products"
        @select="openProduct"
        @end-reached="onEndReached"
      />
      <p v-if="loading" class="mt-3 text-center text-sm text-neutral-500" role="status">
        Loading more products…
      </p>
      <p
        v-else-if="inlineError && copy"
        class="mt-3 text-center text-sm text-danger-700"
        role="alert"
      >
        {{ copy.detail }}
      </p>
    </template>
  </section>
</template>
