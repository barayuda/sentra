<script setup lang="ts">
defineProps<{
  /** Remote that failed, as named in the manifest. */
  name: string
  /** Why it failed, already redacted by the loader. */
  reason: string
}>()
</script>

<template>
  <section role="alert" class="m-6 rounded border border-amber-300 bg-amber-50 p-6">
    <h1 class="mb-2 text-lg font-semibold">{{ name }} is unavailable</h1>
    <p class="text-sm text-amber-900">{{ reason }}</p>
    <p class="mt-3 text-sm text-amber-900">
      The rest of the application is still working — use the navigation above.
    </p>
  </section>
</template>
