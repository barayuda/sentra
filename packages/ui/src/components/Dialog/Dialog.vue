<script setup lang="ts">
import { useScrollLock } from '@vueuse/core'
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import { computed, onMounted, ref, useId, useTemplateRef, watch } from 'vue'

/**
 * Modal dialog. Teleports to `body`, traps focus while open, locks body
 * scroll, and closes on Escape or overlay click. Rendering is deferred until
 * after mount so the teleport target exists — this is what makes the
 * component safe under SSR, where `document` is unavailable during setup.
 *
 * `placement` chooses between a centred modal and an edge-anchored drawer.
 * The two differ only in layout: both are `aria-modal`, both trap focus, both
 * lock scroll, both dismiss on Escape and overlay click. A drawer needs every
 * one of those behaviours, so it is a placement of this component rather than
 * a component of its own — the alternative was duplicating the focus-trap
 * configuration below, which is the part that is genuinely hard to get right.
 */
const props = withDefaults(
  defineProps<{
    /** Controls visibility; supports `v-model`. */
    modelValue: boolean
    /** Required accessible title, rendered in the header and wired via aria-labelledby. */
    title: string
    /** Optional supporting text, wired via aria-describedby when present. */
    description?: string
    /**
     * Where the panel sits: centred in the viewport, or flush against its
     * inline end as a full-height drawer. Defaults to `center` so existing
     * consumers are unaffected.
     */
    placement?: 'center' | 'end'
  }>(),
  { description: undefined, placement: 'center' },
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

/**
 * Layout for the two placements, written as whole class strings rather than
 * assembled from fragments: Tailwind resolves classes by scanning source text,
 * so a name built by concatenation at runtime is never generated.
 *
 * The drawer drops the container padding (so the panel meets the viewport
 * edge) and drops the corner radius on that same edge.
 */
const containerClass = computed(() =>
  props.placement === 'end' ? 'items-stretch justify-end' : 'items-center justify-center p-4',
)

const panelClass = computed(() =>
  props.placement === 'end' ? 'flex h-full w-full max-w-md flex-col' : 'w-full max-w-md rounded-lg',
)

/**
 * The drawer is a three-part column — header, scrolling body, pinned footer —
 * rather than one panel that scrolls as a whole. Overflow therefore lives on
 * the body, not on the panel: a cart with thirty lines must not push its
 * checkout button off the bottom of the viewport, and a panel-level scroll
 * does exactly that. `min-h-0` is what lets the body actually shrink; without
 * it a flex child's automatic minimum size is its content height, so the
 * column grows past the panel and the overflow never engages.
 *
 * The centred placement keeps its natural height — a modal sized to its
 * content has nothing to pin and nothing to scroll.
 */
const bodyClass = computed(() =>
  props.placement === 'end' ? 'mt-4 min-h-0 flex-1 overflow-y-auto' : 'mt-4',
)

/**
 * Centred dialogs end in a row of actions aligned to the trailing edge
 * (Cancel, then Confirm). A drawer's footer is a full-width bar, so its
 * children stack and stretch instead.
 */
const footerClass = computed(() =>
  props.placement === 'end' ? 'mt-6 flex flex-col gap-2' : 'mt-6 flex justify-end gap-2',
)

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
      // Conditional fallback, not an override: happy-dom's tabbable
      // computation is unreliable enough that focus-trap's own internal
      // `.focus()` call sometimes silently no-ops under it (a documented
      // environment risk, not a real-browser concern). The containment
      // check means this only engages when nothing inside the panel
      // already holds focus — so it can never steal focus away from a
      // real tabbable element (e.g. a footer button) that activate()
      // correctly focused; it only rescues the case where activate()
      // left focus outside the panel entirely.
      if (!panelRef.value?.contains(document.activeElement)) {
        panelRef.value?.focus()
      }
    } else {
      deactivate()
    }
  },
  { flush: 'post' },
)

function onOverlayClick(): void {
  emit('update:modelValue', false)
}

/**
 * Stacking comes from `@sentra/tokens` (`--z-index-overlay` 1200 <
 * `--z-index-modal` 1300 < `--z-index-toast` 1400), not from Tailwind's
 * numeric scale. The ordering is deliberate: a toast raised while a modal is
 * open must remain visible, because a toast is frequently the *result* of an
 * action taken inside the modal.
 */
</script>

<template>
  <Teleport v-if="isMounted" to="body">
    <div
      v-if="modelValue"
      :class="['fixed inset-0 z-[var(--z-index-overlay)] flex', containerClass]"
    >
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
        :class="['relative z-[var(--z-index-modal)] bg-neutral-50 p-6 shadow-lg', panelClass]"
      >
        <h2 :id="titleId" class="text-lg font-semibold text-neutral-900">{{ title }}</h2>
        <p v-if="description" :id="descriptionId" class="mt-1 text-sm text-neutral-500">
          {{ description }}
        </p>
        <div data-testid="dialog-body" :class="bodyClass"><slot /></div>
        <div v-if="$slots.footer" data-testid="dialog-footer" :class="footerClass">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
