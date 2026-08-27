<script setup lang="ts">
import { computed, useId, useTemplateRef, watchEffect } from 'vue'
import { FOCUS_CLASSES } from '../../shared/controls.ts'

/**
 * A labelled checkbox supporting the indeterminate ("mixed") state.
 *
 * Indeterminate is a DOM property with no attribute equivalent, so it is applied
 * imperatively through a template ref rather than declaratively in the template.
 * This is the reason the component holds a ref at all.
 */
const props = withDefaults(
  defineProps<{
    /** Visible label text. Required — an unlabelled control is a defect. */
    label: string
    /** Whether the box is checked. Use with `v-model`. */
    modelValue?: boolean
    /**
     * Whether the box shows the mixed state.
     *
     * Used for a parent checkbox governing a partially-selected group. Visually
     * and semantically distinct from both checked and unchecked.
     */
    indeterminate?: boolean
    /** Supplementary text rendered beneath the label. */
    description?: string
    /** Whether the control is unavailable. */
    disabled?: boolean
  }>(),
  {
    modelValue: false,
    indeterminate: false,
    description: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  /** Emitted with the new checked state when the user toggles the box. */
  'update:modelValue': [value: boolean]
}>()

/** Collision-free, SSR-safe base id for this instance. */
const fieldId = useId()
/** Id of the description paragraph, referenced by `aria-describedby`. */
const descriptionId = computed(() => `${fieldId}-description`)

/** The underlying input element, needed to set the indeterminate property. */
const inputRef = useTemplateRef<HTMLInputElement>('input')

/**
 * Mirrors the `indeterminate` prop onto the DOM property.
 *
 * `watchEffect` rather than `onMounted` so a later prop change is applied too;
 * the ref is null-checked because the effect's first run happens during setup,
 * before the template ref is attached. `flush: 'post'` is required, not
 * cosmetic: with the default `'pre'` timing, the re-run triggered once the ref
 * attaches is deferred to a microtask, so a synchronous read of `.indeterminate`
 * immediately after mount (as this component's own tests do) would still see
 * the stale value. Post-flush callbacks run synchronously at the end of the
 * initial mount — the same mechanism that makes `onMounted` visible
 * synchronously once `app.mount()` returns — so the property is set in time.
 */
watchEffect(
  () => {
    if (inputRef.value) {
      inputRef.value.indeterminate = props.indeterminate
    }
  },
  { flush: 'post' },
)

/**
 * Forwards the new checked state to the parent.
 *
 * @param event - The native `change` event.
 */
function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="flex items-start gap-2">
    <input
      :id="fieldId"
      ref="input"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-describedby="description ? descriptionId : undefined"
      :class="[
        FOCUS_CLASSES,
        'mt-1 size-4 rounded-sm border border-neutral-300 text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed',
      ]"
      @change="onChange"
    />
    <div class="flex flex-col">
      <label :for="fieldId" class="text-sm font-medium text-neutral-700">{{ label }}</label>
      <p v-if="description" :id="descriptionId" class="text-sm text-neutral-500">
        {{ description }}
      </p>
    </div>
  </div>
</template>
