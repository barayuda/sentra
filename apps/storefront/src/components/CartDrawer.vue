<script setup lang="ts">
import { useI18n } from '@sentra/i18n'
import { useAnalytics } from '@sentra/plugin-analytics'
import { shopifyImageUrl } from '@sentra/sdk-commerce'
import { Button, Dialog, Money } from '@sentra/ui'
import { computed } from 'vue'
import { resolveErrorCopy } from '../lib/errorCopy.ts'
import { useCartStore } from '../stores/cart.ts'

/**
 * Cart contents in an edge-anchored drawer, built on `Dialog`'s `end`
 * placement.
 *
 * Built on the design system's dialog rather than a bespoke drawer so it
 * inherits the focus trap, scroll lock, Escape handling, and ARIA wiring that
 * component already proves in Storybook — the reuse the component library
 * exists to make possible. `Dialog` originally offered only a centred modal,
 * so this component rendered as one despite its name; the placement prop
 * exists so the reuse no longer costs the shape the cart actually wants.
 *
 * Lines go in the body, which scrolls; the subtotal and checkout go in the
 * footer, which the drawer pins to the bottom. That split is the point of
 * using the footer slot at all — with everything in one scrolling column the
 * checkout button sinks below the fold once the cart holds more lines than
 * fit the viewport, which is precisely when a customer most wants it.
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
const { t } = useI18n()

const failure = computed(() => (cart.error ? resolveErrorCopy(t, cart.error) : null))

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
    :title="t('storefront.cartDrawer.title')"
    placement="end"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!--
      This alert sits above the empty/non-empty pair rather than inside the
      non-empty branch: a failed `restore()` sets `error` while leaving
      `cart` null, so `cart.isEmpty` is true — nesting the alert inside
      `v-else` would silently hide exactly the failure this store exists to
      distinguish from a genuinely empty cart.
    -->
    <p v-if="failure" role="alert" class="text-sm text-danger-700">{{ failure.detail }}</p>

    <div v-if="cart.isEmpty" data-testid="cart-empty" class="py-6 text-center">
      <p class="text-sm font-medium text-neutral-900">
        {{ t('storefront.cartDrawer.emptyTitle') }}
      </p>
      <p class="mt-1 text-sm text-neutral-500">{{ t('storefront.cartDrawer.emptyDetail') }}</p>
    </div>

    <ul v-else class="flex flex-col gap-4">
      <!-- If this ever becomes a per-line disable instead of the global
           `cart.loading`, the store's generation guard (added for the exact
           same superseded-write race) is what keeps concurrent mutations safe —
           don't remove one without the other. -->
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
              :aria-label="
                t('storefront.cartDrawer.decreaseQuantity', { productTitle: line.productTitle })
              "
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
              :aria-label="
                t('storefront.cartDrawer.increaseQuantity', { productTitle: line.productTitle })
              "
              @click="adjust(line.id, line.quantity + 1)"
            >
              +
            </Button>
            <Button
              variant="ghost"
              size="sm"
              :disabled="cart.loading"
              :aria-label="
                t('storefront.cartDrawer.removeLine', { productTitle: line.productTitle })
              "
              @click="remove(line.id, line.quantity)"
            >
              {{ t('storefront.cartDrawer.remove') }}
            </Button>
          </div>
        </div>
      </li>
    </ul>

    <!--
      The summary goes in `Dialog`'s footer slot, which the `end` placement
      pins below the scrolling body. Keeping it here rather than after the
      line list is what makes checkout reachable without scrolling a long
      cart to the bottom first.

      It renders only for a non-empty cart: an empty drawer showing a $0
      subtotal above a dead checkout button is worse than showing neither.
    -->
    <template #footer>
      <template v-if="!cart.isEmpty">
        <div class="flex items-center justify-between border-t border-neutral-200 pt-3">
          <span class="text-sm text-neutral-700">{{ t('storefront.cartDrawer.subtotal') }}</span>
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
          {{ t('storefront.cartDrawer.checkout') }}
        </a>
      </template>
    </template>
  </Dialog>
</template>
