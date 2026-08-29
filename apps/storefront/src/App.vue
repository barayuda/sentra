<script setup lang="ts">
import { useShellBus } from '@sentra/shell-contract'
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import CartOverlay from './federated/CartOverlay.vue'
import { useCartStore } from './stores/cart.ts'

/**
 * Application shell: header, routed view, cart overlay.
 *
 * The cart is restored after mount rather than during setup so a slow or
 * failing cart lookup never delays first paint — the catalogue is useful before
 * the cart is known.
 */
const cart = useCartStore()
const bus = useShellBus()

/** Routes the header's button through the same event the shell's header uses. */
function openCart(): void {
  bus.emit('cart:open-requested', { origin: 'storefront-header' })
}

onMounted(() => void cart.restore())
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
