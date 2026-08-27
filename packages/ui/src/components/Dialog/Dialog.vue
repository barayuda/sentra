<script setup lang="ts">
import { useScrollLock } from '@vueuse/core'
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import { computed, onMounted, ref, useId, useTemplateRef, watch } from 'vue'

/**
 * Modal dialog. Teleports to `body`, traps focus while open, locks body
 * scroll, and closes on Escape or overlay click. Rendering is deferred until
 * after mount so the teleport target exists — this is what makes the
 * component safe under SSR, where `document` is unavailable during setup.
 */
const props = withDefaults(
  defineProps<{
    /** Controls visibility; supports `v-model`. */
    modelValue: boolean
    /** Required accessible title, rendered in the header and wired via aria-labelledby. */
    title: string
    /** Optional supporting text, wired via aria-describedby when present. */
    description?: string
  }>(),
  { description: undefined },
)

const emit = defineEmits<{
  /** Emitted with `false` when the dialog asks to close (Escape, overlay click). */
  'update:modelValue': [value: boolean]
}>()

/** SSR guard: Teleport renders only after the component mounted client-side. */
const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})

/** Stable id pair for the ARIA associations. */
const titleId = `${useId()}-title`
const descriptionId = `${useId()}-description`

const describedBy = computed(() => (props.description ? descriptionId : undefined))

const panelRef = useTemplateRef<HTMLElement>('panel')

/**
 * Focus trap over the panel. `fallbackFocus` points at the panel itself
 * (which carries tabindex="-1") so activation never throws when a dialog
 * happens to contain no tabbable children.
 *
 * `allowOutsideClick: true` is required, not cosmetic: the overlay backdrop
 * is a sibling of `panelRef`, deliberately outside the trap boundary so it
 * stays clickable. focus-trap's defaults (`clickOutsideDeactivates: false`,
 * `allowOutsideClick: false`) install a capturing `click` listener on
 * `document` that calls `preventDefault()` + `stopImmediatePropagation()`
 * for any click outside the trap — which runs in the capture phase, before
 * the event ever reaches the overlay's own bubble-phase `@click` handler.
 * Without this option the "click the overlay to close" interaction is
 * silently swallowed, in real browsers as well as tests: it is not a
 * happy-dom artifact, it is focus-trap's documented outside-click policy.
 */
const { activate, deactivate } = useFocusTrap(panelRef, {
  immediate: false,
  escapeDeactivates: true,
  allowOutsideClick: true,
  fallbackFocus: () => panelRef.value as HTMLElement,
  onDeactivate: () => emit('update:modelValue', false),
})

/** Body scroll lock, driven by the open state. */
const scrollLocked = useScrollLock(() => (isMounted.value ? document.body : null))

watch(
  () => props.modelValue && isMounted.value,
  async (open) => {
    scrollLocked.value = open
    if (open) {
      await Promise.resolve()
      activate()
      // Belt-and-braces beyond `activate()`: happy-dom's tabbable
      // computation is unreliable enough that focus-trap's own internal
      // `.focus()` call sometimes silently no-ops under it (a documented
      // environment risk, not a real-browser concern — activate() has
      // already moved focus there in production). Calling `.focus()`
      // directly on the fallback target is a harmless no-op when
      // focus-trap already succeeded, and decisive when it didn't.
      panelRef.value?.focus()
    } else {
      deactivate()
    }
  },
  { flush: 'post' },
)

function onOverlayClick(): void {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport v-if="isMounted" to="body">
    <div v-if="modelValue" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        data-testid="dialog-overlay"
        class="absolute inset-0 bg-neutral-900/50"
        @click="onOverlayClick"
      />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="describedBy"
        tabindex="-1"
        class="relative z-50 w-full max-w-md rounded-lg bg-neutral-50 p-6 shadow-lg"
      >
        <h2 :id="titleId" class="text-lg font-semibold text-neutral-900">{{ title }}</h2>
        <p v-if="description" :id="descriptionId" class="mt-1 text-sm text-neutral-500">
          {{ description }}
        </p>
        <div class="mt-4"><slot /></div>
        <div v-if="$slots.footer" class="mt-6 flex justify-end gap-2"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>
