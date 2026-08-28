<script setup lang="ts">
import { useAnalytics } from '@sentra/plugin-analytics'
import { ToastHost } from '@sentra/ui'
import { onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import CartDrawer from './components/CartDrawer.vue'
import { useCartStore } from './stores/cart.ts'

/**
 * Application shell: header, routed view, cart drawer, toast host.
 *
 * The cart is restored after mount rather than during setup so a slow or
 * failing cart lookup never delays first paint — the catalogue is useful before
 * the cart is known.
 */
const cart = useCartStore()
const analytics = useAnalytics()
const cartOpen = ref(false)

onMounted(() => {
  void cart.restore()
})

/** Opens the drawer and reports it with the item count for funnel analysis. */
function openCart(): void {
  cartOpen.value = true
  analytics.track('cart_open', { itemCount: cart.itemCount })
}
</script>

<template>
  <div class="min-h-dvh bg-neutral-100">
    <AppHeader :item-count="cart.itemCount" @open-cart="openCart" />
    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
    <CartDrawer v-model="cartOpen" />
    <ToastHost />
  </div>
</template>
