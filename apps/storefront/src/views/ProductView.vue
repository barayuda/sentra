<script setup lang="ts">
import { useProduct } from '@sentra/sdk-commerce/vue'

/** Replaced in Task 12 by the full product detail page. */
const props = defineProps<{ handle: string }>()
const { data, loading } = useProduct(() => props.handle)
</script>

<template>
  <section>
    <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    <h1 v-else-if="data" class="text-xl font-semibold text-neutral-900">{{ data.title }}</h1>
    <p v-else class="text-sm text-neutral-700">Product not found.</p>
  </section>
</template>
