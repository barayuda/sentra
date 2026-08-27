<script setup lang="ts">
import { computed, useId } from 'vue'
import { FIELD_CLASSES, FOCUS_CLASSES, SIZE_CLASSES, type Size } from '../../shared/controls.ts'

/**
 * A labelled single-line text field.
 *
 * `label` is required rather than optional: an unlabelled input is an
 * accessibility defect, and making the prop required moves that from a review
 * comment to a compile error.
 */
const props = withDefaults(
  defineProps<{
    /** Visible label text. Required — see the component description. */
    label: string
    /** Current value. Use with `v-model`. */
    modelValue?: string
    /** Control height. */
    size?: Size
    /** Native input type, which determines the mobile keyboard shown. */
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url'
    /** Validation message. When non-empty the field renders as invalid. */
    error?: string
    /** Supplementary guidance rendered beneath the control. */
    hint?: string
    /** Whether the control is unavailable. */
    disabled?: boolean
    /** Whether the field must be completed. */
    required?: boolean
  }>(),
  {
    modelValue: '',
    size: 'md',
    type: 'text',
    error: '',
    hint: '',
    disabled: false,
    required: false,
  },
)

const emit = defineEmits<{
  /** Emitted on every keystroke with the control's new value. */
  'update:modelValue': [value: string]
}>()

/** Collision-free, SSR-safe base id for this instance. */
const fieldId = useId()
/** Id of the error paragraph, referenced by `aria-describedby`. */
const errorId = computed(() => `${fieldId}-error`)
/** Id of the hint paragraph, referenced by `aria-describedby`. */
const hintId = computed(() => `${fieldId}-hint`)

/**
 * Space-separated ids of the descriptions currently rendered.
 *
 * Returns `undefined` rather than an empty string when nothing is described, so
 * Vue omits the attribute instead of emitting `aria-describedby=""` — which
 * assistive technology would treat as a dangling reference. Hint precedes
 * error so the order assistive technology announces them in matches the
 * order they render in: the hint paragraph sits above the error paragraph in
 * the template.
 */
const describedBy = computed<string | undefined>(() => {
  const ids: string[] = []
  if (props.hint) ids.push(hintId.value)
  if (props.error) ids.push(errorId.value)
  return ids.length > 0 ? ids.join(' ') : undefined
})

/**
 * Forwards the control's new value to the parent.
 *
 * @param event - The native `input` event.
 */
function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :for="fieldId" class="text-sm font-medium text-neutral-700">
      {{ label }}
      <span v-if="required" aria-hidden="true" class="text-danger-500">*</span>
    </label>
    <input
      :id="fieldId"
      :type="type"
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
      :class="[FIELD_CLASSES, FOCUS_CLASSES, SIZE_CLASSES[size]]"
      @input="onInput"
    />
    <p v-if="hint" :id="hintId" class="text-sm text-neutral-500">{{ hint }}</p>
    <p v-if="error" :id="errorId" role="alert" class="text-sm text-danger-700">{{ error }}</p>
  </div>
</template>
