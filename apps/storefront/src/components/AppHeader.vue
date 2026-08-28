<script setup lang="ts">
import { Button } from '@sentra/ui'

/**
 * Site header: brand, collection link, and the cart trigger.
 *
 * The cart count is passed in rather than read from the store here, so this
 * component stays a pure presentational unit and can be rendered in a story
 * without a Pinia instance.
 */
defineProps<{
  /** Items currently in the cart. */
  itemCount: number
}>()

const emit = defineEmits<{
  /** The cart button was activated. */
  openCart: []
}>()
</script>

<template>
  <header class="border-b border-neutral-200 bg-neutral-50">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
      <RouterLink
        to="/"
        class="text-lg font-semibold text-neutral-900 no-underline hover:text-brand-700"
      >
        Sentra
      </RouterLink>
      <Button variant="secondary" @click="emit('openCart')">
        Cart
        <span v-if="itemCount > 0" class="ml-1 font-semibold" aria-hidden="true">
          ({{ itemCount }})
        </span>
        <span class="sr-only">
          {{ itemCount === 0 ? 'empty' : `${itemCount} item${itemCount === 1 ? '' : 's'}` }}
        </span>
      </Button>
    </div>
  </header>
</template>
