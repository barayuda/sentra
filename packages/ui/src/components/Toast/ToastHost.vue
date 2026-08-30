<script setup lang="ts">
import { useToast } from './plugin.ts'
import { TOAST_MOTION } from '../../shared/motion.ts'

/**
 * Renders the toast queue in a fixed viewport corner. Purely presentational:
 * all state lives in the service, so multiple hosts (unusual but legal)
 * render the same queue.
 */
const service = useToast()

const VARIANT_CLASSES: Record<string, string> = {
  info: 'border-neutral-300 bg-neutral-50 text-neutral-900',
  success: 'border-success-500 bg-neutral-50 text-neutral-900',
  danger: 'border-danger-500 bg-neutral-50 text-neutral-900',
}
</script>

<template>
  <!--
    A TransitionGroup rather than a plain container with animated children.
    The difference is `moveClass`: when a toast in the middle of the stack is
    dismissed, the ones below it have to travel to their new positions, and
    only a group transition animates that. Without it the survivors jump the
    instant the dismissed toast unmounts — the one moment the stack is most
    likely to be under the user's eye.
  -->
  <TransitionGroup
    tag="div"
    v-bind="TOAST_MOTION"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-index-toast)] flex flex-col items-end gap-2 p-4"
  >
    <div
      v-for="toast in service.toasts.value"
      :key="toast.id"
      :role="toast.variant === 'danger' ? 'alert' : 'status'"
      class="pointer-events-auto w-full max-w-sm rounded-md border-l-4 p-4 shadow-md"
      :class="VARIANT_CLASSES[toast.variant]"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">{{ toast.title }}</p>
          <p v-if="toast.description" class="mt-1 text-sm text-neutral-500">
            {{ toast.description }}
          </p>
        </div>
        <button
          type="button"
          class="text-sm text-neutral-500 hover:text-neutral-900"
          aria-label="Dismiss notification"
          @click="service.dismiss(toast.id)"
        >
          ✕
        </button>
      </div>
    </div>
  </TransitionGroup>
</template>
