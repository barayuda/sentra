<script setup lang="ts">
import Money from '../Money/Money.vue'
import { FOCUS_CLASSES } from '../../shared/controls.ts'

/**
 * Product summary card: image, badge, title, price, description slot, and a
 * footer slot for actions. The description slot renders text/VNodes only —
 * deliberately no `v-html`. Shopify product descriptions arrive as
 * merchant-authored HTML, which is a stored-XSS vector; the sanitisation
 * boundary that makes that HTML renderable is an M3 (`sdk-commerce`)
 * deliverable, and until it exists this card refuses raw HTML by design.
 *
 * The body's activation surface is a real `<button type="button">` rather
 * than a `<div>` with a click handler: a `div` with `@click` is invisible to
 * keyboard and assistive-technology users (unfocusable, unannounced), and
 * static tools like axe cannot flag a bare click handler as the missing
 * affordance it is. The button is styled `block w-full text-left` so it
 * fills the same footprint and reads identically to the previous `div`.
 */
withDefaults(
  defineProps<{
    /** Product title, rendered as the card heading. */
    title: string
    /** Price in the Money contract: Shopify-style decimal string or number, plus code. */
    price: { amount: number | string; currency: string }
    /** Product image URL; the card reserves the space either way. */
    imageSrc?: string
    /** Responsive candidates for the image; pairs with imageSrc as the fallback. */
    imageSrcset?: string
    /** Image alt text — required for a meaningful image (a11y). */
    imageAlt?: string
    /** Short callout rendered over the image, e.g. `'New'`, `'Sale'`. */
    badge?: string
    /** Skeleton state: hides content and marks the card busy. */
    loading?: boolean
  }>(),
  { imageSrc: undefined, imageSrcset: undefined, imageAlt: '', badge: undefined, loading: false },
)

const emit = defineEmits<{
  /** Emitted when the card body is activated. */
  select: []
}>()
</script>

<template>
  <article
    data-testid="product-card"
    :aria-busy="loading || undefined"
    class="overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50"
  >
    <template v-if="loading">
      <div class="h-40 animate-pulse bg-neutral-200" />
      <div class="space-y-2 p-4">
        <div class="h-4 w-2/3 animate-pulse rounded bg-neutral-200" />
        <div class="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
      </div>
    </template>
    <template v-else>
      <div class="relative">
        <img
          v-if="imageSrc"
          :src="imageSrc"
          :srcset="imageSrcset"
          sizes="(min-width: 768px) 33vw, 100vw"
          :alt="imageAlt"
          class="h-40 w-full object-cover"
          loading="lazy"
        />
        <div v-else class="h-40 w-full bg-neutral-100" aria-hidden="true" />
        <span
          v-if="badge"
          class="absolute left-2 top-2 rounded bg-brand-600 px-2 py-0.5 text-xs font-semibold text-neutral-50"
        >
          {{ badge }}
        </span>
      </div>
      <button
        type="button"
        :class="[FOCUS_CLASSES, 'block w-full cursor-pointer p-4 text-left']"
        @click="emit('select')"
      >
        <h3 class="text-sm font-semibold text-neutral-900">{{ title }}</h3>
        <p class="mt-1 text-sm font-medium text-neutral-700">
          <Money :amount="price.amount" :currency="price.currency" />
        </p>
        <div v-if="$slots.default" class="mt-2 text-sm text-neutral-500"><slot /></div>
      </button>
      <div v-if="$slots.footer" class="border-t border-neutral-200 p-3"><slot name="footer" /></div>
    </template>
  </article>
</template>
