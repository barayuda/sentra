<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

/**
 * `from` is a path this app defines (set by {@link createRoleGuard}), not
 * user input — it is rendered as text below, never as markup.
 */
const route = useRoute()
const from = computed(() => {
  const value = route.query.from
  return typeof value === 'string' ? value : null
})
</script>

<template>
  <section role="alert" class="mx-auto max-w-md py-16 text-center">
    <h1 class="text-xl font-semibold text-neutral-900">You don't have access to this page</h1>
    <p v-if="from" class="mt-2 text-sm text-neutral-500">
      Your current role can't reach <span class="font-medium">{{ from }}</span
      >.
    </p>
    <p v-else class="mt-2 text-sm text-neutral-500">Your current role can't reach that page.</p>
    <RouterLink to="/" class="mt-6 inline-block text-sm font-medium text-brand-700 underline">
      Back to home
    </RouterLink>
  </section>
</template>
