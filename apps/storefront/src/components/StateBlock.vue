<script setup lang="ts">
/**
 * One presentation for loading, empty, and error states.
 *
 * These three exist as a shared component, with a story each, because spec §8
 * treats them as documented artifacts rather than incidental markup — the
 * states most likely to be built inconsistently are the ones nobody
 * demonstrates.
 *
 * `role="status"` with `aria-live="polite"` means a state change is announced
 * without stealing focus; an error uses `role="alert"`, which is assertive
 * because the reader's task just failed.
 */
withDefaults(
  defineProps<{
    /** Which state this is. */
    variant: 'loading' | 'empty' | 'error'
    /** Short heading. */
    title: string
    /** Optional supporting sentence. */
    detail?: string
  }>(),
  { detail: undefined },
)
</script>

<template>
  <div
    :data-testid="`state-${variant}`"
    :role="variant === 'error' ? 'alert' : 'status'"
    :aria-live="variant === 'error' ? 'assertive' : 'polite'"
    :aria-busy="variant === 'loading' || undefined"
    class="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-12 text-center"
  >
    <p class="text-base font-semibold text-neutral-900">{{ title }}</p>
    <p v-if="detail" class="max-w-prose text-sm text-neutral-700">{{ detail }}</p>
    <div v-if="$slots.action" class="mt-2"><slot name="action" /></div>
  </div>
</template>
