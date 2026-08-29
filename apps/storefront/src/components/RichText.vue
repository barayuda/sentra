<script setup lang="ts">
import { sanitizeProductHtml, type UnsafeHtml } from '@sentra/sdk-commerce'
import { computed } from 'vue'

/**
 * The one place merchant-authored HTML reaches the DOM.
 *
 * `vue/no-v-html` is an ESLint **error** across this repository, and this file
 * holds its only exception. That is the entire design: making the rule an error
 * means a `v-html` cannot be added anywhere without a reviewer seeing a
 * deliberate suppression, and concentrating the exception in one small
 * component means the audit surface for stored XSS is this file rather than
 * every template that happens to render a product.
 *
 * What makes the suppression defensible:
 *
 * - The input type is {@link UnsafeHtml}, a branded string the SDK applies at
 *   the wire boundary. It cannot be produced by accident, and the compiler
 *   rejects passing it anywhere a plain string is expected.
 * - The value rendered is the return of `sanitizeProductHtml`, which is
 *   allowlist-based and DOMPurify-backed (see `packages/sdk-commerce/src/sanitize.ts`).
 * - Sanitisation is `computed`, so a changed description is re-sanitised rather
 *   than reusing an earlier result.
 *
 * What would make it indefensible, and must never be done: widening the prop to
 * `string`, sanitising in a parent and passing the result here, or adding a
 * second `v-html` elsewhere "just for this one case".
 */
const props = defineProps<{
  /** Merchant-authored HTML, straight from the Storefront API. */
  html: UnsafeHtml
}>()

/** Sanitised output; the only value permitted to reach `v-html`. */
const safeHtml = computed(() => sanitizeProductHtml(props.html))
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- Sanitised by sanitizeProductHtml (DOMPurify, allowlist) immediately above; see this component's description. -->
  <div
    data-testid="rich-text"
    class="space-y-3 text-sm leading-relaxed text-neutral-700 [&_a]:text-brand-700 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold"
    v-html="safeHtml"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
