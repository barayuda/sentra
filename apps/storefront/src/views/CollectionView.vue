<script setup lang="ts">
import { useCollection } from '@sentra/sdk-commerce/vue'
import { DEFAULT_COLLECTION_HANDLE } from '../router.ts'

/** Replaced in Task 11 by the virtualised grid. */
const { products, title, loading } = useCollection(DEFAULT_COLLECTION_HANDLE, { pageSize: 12 })
</script>

<template>
  <section>
    <h1 class="text-xl font-semibold text-neutral-900">{{ title || 'Collection' }}</h1>
    <p v-if="loading" class="mt-2 text-sm text-neutral-500">Loading…</p>
    <p class="mt-2 text-sm text-neutral-700" data-testid="product-count">
      {{ products.length }} products loaded
    </p>
  </section>
</template>
