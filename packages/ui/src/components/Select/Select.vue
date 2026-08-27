<script setup lang="ts">
import { computed, useId } from 'vue'
import { FIELD_CLASSES, FOCUS_CLASSES, SIZE_CLASSES, type Size } from '../../shared/controls.ts'
import type { SelectOption } from './options.ts'

/**
 * A labelled single-choice dropdown built on the native `<select>` element.
 *
 * Native rather than custom: the platform control already provides correct
 * keyboard navigation, type-ahead, and mobile pickers. The custom `Combobox`
 * arriving in M2 exists only for cases the native element genuinely cannot serve
 * (async search, multi-select with tags), and must match this component's
 * accessibility behaviour.
 */
withDefaults(
  defineProps<{
    /** Visible label text. Required — an unlabelled control is a defect. */
    label: string
    /** Available choices, in display order. */
    options: readonly SelectOption[]
    /** Currently selected value. Use with `v-model`. */
    modelValue?: string
    /** Control height. */
    size?: Size
    /**
     * Text for a leading empty option representing "nothing chosen".
     *
     * Omit it when a selection is always present; the option is only rendered
     * when this is non-empty.
     */
    placeholder?: string
    /** Validation message. When non-empty the field renders as invalid. */
    error?: string
    /** Whether the control is unavailable. */
    disabled?: boolean
    /** Whether a choice must be made. */
    required?: boolean
  }>(),
  {
    modelValue: '',
    size: 'md',
    placeholder: '',
    error: '',
    disabled: false,
    required: false,
  },
)

const emit = defineEmits<{
  /** Emitted when the user picks a different option. */
  'update:modelValue': [value: string]
}>()

/** Collision-free, SSR-safe base id for this instance. */
const fieldId = useId()
/** Id of the error paragraph, referenced by `aria-describedby`. */
const errorId = computed(() => `${fieldId}-error`)

/**
 * Forwards the newly selected value to the parent.
 *
 * @param event - The native `change` event.
 */
function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :for="fieldId" class="text-sm font-medium text-neutral-700">
      {{ label }}
      <span v-if="required" aria-hidden="true" class="text-danger-500">*</span>
    </label>
    <select
      :id="fieldId"
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="error ? errorId : undefined"
      :class="[FIELD_CLASSES, FOCUS_CLASSES, SIZE_CLASSES[size]]"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <p v-if="error" :id="errorId" role="alert" class="text-sm text-danger-700">{{ error }}</p>
  </div>
</template>
