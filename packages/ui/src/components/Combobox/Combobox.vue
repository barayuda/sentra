<script setup lang="ts">
import { useI18n } from '@sentra/i18n'
import { computed, ref, useId, watch } from 'vue'
import { FIELD_CLASSES, FOCUS_CLASSES, SIZE_CLASSES, type Size } from '../../shared/controls.ts'
import { POPOVER_MOTION } from '../../shared/motion.ts'
import type { SelectOption } from '../Select/options.ts'

/**
 * Single-select combobox implementing the WAI-ARIA 1.2 pattern: a
 * `role="combobox"` input controls a `role="listbox"` popup, and the active
 * option is referenced by `aria-activedescendant` so DOM focus never leaves
 * the input. Options come either from the static `options` prop (filtered
 * locally, case-insensitive) or from `loadOptions` (async; out-of-order
 * responses are discarded via a request token rather than debounced — the
 * component guarantees correctness and leaves latency policy to consumers).
 *
 * Out of scope by design: multi-select, free-text creation, debouncing.
 */
const props = withDefaults(
  defineProps<{
    /** Visible label, programmatically associated with the input. */
    label: string
    /** Selected option value; supports `v-model`. */
    modelValue?: string
    /** Static options, filtered locally against the query. */
    options?: SelectOption[]
    /** Async option source; mutually exclusive with `options` in practice. */
    loadOptions?: (query: string) => Promise<SelectOption[]>
    /** Input placeholder. */
    placeholder?: string
    /** Disables the field entirely. */
    disabled?: boolean
    /** Visual scale, shared with every field control. */
    size?: Size
  }>(),
  {
    modelValue: undefined,
    options: () => [],
    loadOptions: undefined,
    placeholder: undefined,
    disabled: false,
    size: 'md',
  },
)

const emit = defineEmits<{
  /** Emitted with the chosen option's value. */
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

const fieldId = useId()
const listboxId = `${fieldId}-listbox`

/** The text currently in the input — the filter query, not the selection. */
const query = ref('')
const isOpen = ref(false)
const activeIndex = ref(-1)
const asyncOptions = ref<SelectOption[]>([])
const isLoading = ref(false)
const loadFailed = ref(false)

/** Monotonic token: only the newest in-flight request may commit results. */
let requestToken = 0

/** What the listbox actually shows. */
const visibleOptions = computed<SelectOption[]>(() => {
  if (props.loadOptions) return asyncOptions.value
  const needle = query.value.trim().toLowerCase()
  if (!needle) return props.options
  return props.options.filter((option) => option.label.toLowerCase().includes(needle))
})

const activeDescendant = computed(() =>
  isOpen.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined,
)

/** Reflect an externally-set selection as the input text. */
watch(
  () => props.modelValue,
  (value) => {
    const match = [...props.options, ...asyncOptions.value].find((o) => o.value === value)
    if (match) query.value = match.label
  },
  { immediate: true },
)

function optionId(index: number): string {
  return `${listboxId}-option-${index}`
}

function open(): void {
  if (props.disabled) return
  isOpen.value = true
}

function close(): void {
  isOpen.value = false
  activeIndex.value = -1
}

async function onInput(event: Event): Promise<void> {
  query.value = (event.target as HTMLInputElement).value
  open()
  activeIndex.value = -1
  if (!props.loadOptions) return
  const token = ++requestToken
  isLoading.value = true
  loadFailed.value = false
  try {
    const results = await props.loadOptions(query.value)
    if (token !== requestToken) return
    asyncOptions.value = results
  } catch {
    if (token !== requestToken) return
    loadFailed.value = true
    asyncOptions.value = []
  } finally {
    if (token === requestToken) isLoading.value = false
  }
}

function select(index: number): void {
  const option = visibleOptions.value[index]
  if (!option || option.disabled) return
  emit('update:modelValue', option.value)
  query.value = option.label
  close()
}

function onKeydown(event: KeyboardEvent): void {
  if (props.disabled) return
  const max = visibleOptions.value.length - 1
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) open()
      activeIndex.value = Math.min(activeIndex.value + 1, max)
      break
    case 'ArrowUp':
      event.preventDefault()
      /**
       * ARIA APG: from a closed state, Up Arrow opens the listbox and
       * activates the LAST option (Down Arrow activates the first). The
       * previous `Math.max(activeIndex - 1, 0)` silently activated option 0
       * while the listbox stayed closed, so `aria-activedescendant` pointed
       * at an element that was not in the accessibility tree.
       */
      if (!isOpen.value) {
        open()
        activeIndex.value = max
        break
      }
      activeIndex.value = Math.max(activeIndex.value - 1, 0)
      break
    case 'Home':
      if (!isOpen.value) return
      event.preventDefault()
      activeIndex.value = 0
      break
    case 'End':
      if (!isOpen.value) return
      event.preventDefault()
      activeIndex.value = max
      break
    case 'Enter':
      if (!isOpen.value || activeIndex.value < 0) return
      event.preventDefault()
      select(activeIndex.value)
      break
    case 'Escape':
      close()
      break
    case 'Tab':
      close()
      break
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :for="fieldId" class="text-sm font-medium text-neutral-700">{{ label }}</label>
    <div class="relative">
      <input
        :id="fieldId"
        role="combobox"
        type="text"
        autocomplete="off"
        :value="query"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        aria-autocomplete="list"
        :aria-activedescendant="activeDescendant"
        :class="[FIELD_CLASSES, SIZE_CLASSES[size], FOCUS_CLASSES]"
        class="w-full"
        @input="onInput"
        @keydown="onKeydown"
        @blur="close"
      />
      <Transition v-bind="POPOVER_MOTION">
        <ul
          v-if="isOpen"
          :id="listboxId"
          role="listbox"
          :aria-label="label"
          :aria-busy="isLoading || undefined"
          class="absolute z-[var(--z-index-dropdown)] mt-1 max-h-60 w-full overflow-auto rounded-md border border-neutral-300 bg-neutral-50 py-1 shadow-md"
        >
          <li v-if="isLoading" class="px-3 py-2 text-sm text-neutral-500">
            {{ t('ui.combobox.loading') }}
          </li>
          <li
            v-for="(option, index) in visibleOptions"
            v-else
            :id="optionId(index)"
            :key="option.value"
            role="option"
            :aria-selected="option.value === modelValue"
            :aria-disabled="option.disabled || undefined"
            class="cursor-pointer px-3 py-2 text-sm"
            :class="index === activeIndex ? 'bg-brand-50 text-brand-700' : 'text-neutral-700'"
            @mousedown.prevent
            @click="select(index)"
            @mousemove="activeIndex = index"
          >
            {{ option.label }}
          </li>
          <li
            v-if="!isLoading && !loadFailed && visibleOptions.length === 0"
            class="px-3 py-2 text-sm text-neutral-500"
          >
            {{ t('ui.combobox.noMatches') }}
          </li>
        </ul>
      </Transition>
      <p v-if="loadFailed" role="alert" class="mt-1 text-sm text-danger-500">
        {{ t('ui.combobox.loadFailed') }}
      </p>
    </div>
  </div>
</template>
