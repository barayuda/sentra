<script setup lang="ts">
import { computed } from 'vue'
import type { Size } from '../../shared/controls.ts'
import { buttonClasses, type Variant } from './variants.ts'

/**
 * A button primitive.
 *
 * `disabled` and `loading` are separate props because they mean different things
 * to a screen reader: loading announces a pending operation via `aria-busy`,
 * whereas disabled announces unavailability. Both suppress interaction.
 */
const props = withDefaults(
  defineProps<{
    /** Visual emphasis level. */
    variant?: Variant
    /** Control height. */
    size?: Size
    /** Whether the control is unavailable. */
    disabled?: boolean
    /** Whether an operation triggered by this button is in flight. */
    loading?: boolean
    /**
     * Native button type. Defaults to `'button'` rather than HTML's own default
     * of `'submit'`, so dropping a button into a form cannot submit it
     * unintentionally.
     */
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    type: 'button',
  },
)

/** Whether the control currently accepts interaction. */
const isInteractive = computed(() => !props.disabled && !props.loading)
</script>

<template>
  <button
    :type="type"
    :class="buttonClasses(variant, size)"
    :disabled="!isInteractive"
    :aria-busy="loading || undefined"
  >
    <slot />
  </button>
</template>
