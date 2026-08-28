<script setup lang="ts">
import { useAnalytics } from '@sentra/plugin-analytics'
import { shopifyImageUrl } from '@sentra/sdk-commerce'
import { Button, Dialog, Money } from '@sentra/ui'
import { computed } from 'vue'
import { errorCopy } from '../lib/errorCopy.ts'
import { useCartStore } from '../stores/cart.ts'

/**
 * Cart contents over `Dialog`.
 *
 * Built on the design system's dialog rather than a bespoke drawer so it
 * inherits the focus trap, scroll lock, Escape handling, and ARIA wiring that
 * component already proves in Storybook — the reuse the component library
 * exists to make possible.
 *
 * Quantity controls are buttons rather than a number input on purpose: `Input`
 * has no `number` type, and a stepper communicates the available actions
 * without relying on spinner affordances that vary between browsers.
 */
defineProps<{
  /** Whether the drawer is open; supports `v-model`. */
  modelValue: boolean
}>()

const emit = defineEmits<{
  /** Emitted when the drawer asks to close. */
  'update:modelValue': [value: boolean]
}>()

const cart = useCartStore()
const analytics = useAnalytics()

const failure = computed(() => (cart.error ? errorCopy(cart.error) : null))

/** Adjusts a line by a delta, routing zero through removal in the store. */
async function adjust(lineId: string, quantity: number): Promise<void> {
  await cart.setLineQuantity(lineId, quantity)
}

/** Removes a line and reports it, capturing the quantity before it is gone. */
async function remove(lineId: string, quantity: number): Promise<void> {
  const removed = await cart.removeLine(lineId)
  if (removed) analytics.track('remove_from_cart', { lineId, quantity })
}
</script>

<template>
  <Dialog
    :model-value="modelValue"
    title="Your cart"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="cart.isEmpty" data-testid="cart-empty" class="py-6 text-center">
      <p class="text-sm font-medium text-neutral-900">Your cart is empty</p>
      <p class="mt-1 text-sm text-neutral-500">Add something from the collection to get started.</p>
    </div>

    <div v-else class="flex flex-col gap-4">
      <p v-if="failure" role="alert" class="text-sm text-danger-700">{{ failure.detail }}</p>

      <ul class="flex flex-col gap-4">
        <li v-for="line in cart.lines" :key="line.id" class="flex gap-3">
          <img
            v-if="line.image"
            :src="shopifyImageUrl(line.image.url, { width: 96, height: 96, crop: 'center' })"
            :alt="line.image.altText ?? line.productTitle"
            class="size-16 rounded bg-neutral-100 object-cover"
            width="64"
            height="64"
          />
          <div v-else class="size-16 rounded bg-neutral-100" aria-hidden="true" />

          <div class="flex-1">
            <p class="text-sm font-medium text-neutral-900">{{ line.productTitle }}</p>
            <p class="text-xs text-neutral-500">{{ line.variantTitle }}</p>
            <p class="mt-1 text-sm text-neutral-700">
              <Money :amount="line.price.amount" :currency="line.price.currencyCode" />
            </p>

            <div class="mt-2 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                :disabled="cart.loading"
                :aria-label="`Decrease quantity of ${line.productTitle}`"
                @click="adjust(line.id, line.quantity - 1)"
              >
                −
              </Button>
              <span class="min-w-6 text-center text-sm text-neutral-900" aria-live="polite">
                {{ line.quantity }}
              </span>
              <Button
                variant="secondary"
                size="sm"
                :disabled="cart.loading"
                :aria-label="`Increase quantity of ${line.productTitle}`"
                @click="adjust(line.id, line.quantity + 1)"
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="sm"
                :disabled="cart.loading"
                :aria-label="`Remove ${line.productTitle} from cart`"
                @click="remove(line.id, line.quantity)"
              >
                Remove
              </Button>
            </div>
          </div>
        </li>
      </ul>

      <div class="flex items-center justify-between border-t border-neutral-200 pt-3">
        <span class="text-sm text-neutral-700">Subtotal</span>
        <span data-testid="cart-subtotal" class="text-sm font-semibold text-neutral-900">
          <Money
            v-if="cart.subtotal"
            :amount="cart.subtotal.amount"
            :currency="cart.subtotal.currencyCode"
          />
        </span>
      </div>

      <!--
        Checkout is a plain anchor to Shopify's hosted checkout, not a fetch.
        Payment belongs on Shopify's PCI-compliant origin; routing it through
        this application would put us in scope for card data we have no business
        touching. `rel="noopener noreferrer"` because it opens a new context.
      -->
      <a
        v-if="cart.checkoutUrl"
        :href="cart.checkoutUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-neutral-0 no-underline hover:bg-brand-700"
      >
        Checkout
      </a>
    </div>
  </Dialog>
</template>
