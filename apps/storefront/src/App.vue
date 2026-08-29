<script setup lang="ts">
import { useShellBus } from '@sentra/shell-contract'
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import CartOverlay from './federated/CartOverlay.vue'
import { useCartStore } from './stores/cart.ts'

/**
 * Application shell: header, routed view, cart overlay.
 *
 * Restoring the cart is `registerStorefront()`'s job, not this component's —
 * `register` runs in both standalone and federated mode, so a call here would
 * either duplicate it (standalone) or be the only place it happens at all
 * (federated, where this component never mounts). This component only reads
 * the store the registration hook already populated.
 */
const cart = useCartStore()
const bus = useShellBus()

/** Routes the header's button through the same event the shell's header uses. */
function openCart(): void {
  bus.emit('cart:open-requested', { origin: 'storefront-header' })
}
</script>

<template>
  <div class="min-h-dvh bg-neutral-100">
    <AppHeader :item-count="cart.itemCount" @open-cart="openCart" />
    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
    <CartOverlay />
  </div>
</template>
