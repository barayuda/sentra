<script setup lang="ts">
import { useShellBus } from '@sentra/shell-contract'
import { onUnmounted, ref } from 'vue'
import RoleSwitcher from './RoleSwitcher.vue'

const bus = useShellBus()
const cartQuantity = ref(0)

/**
 * The header is a subscriber, not an owner.
 *
 * The cart lives in the storefront remote's Pinia store, which the shell
 * cannot import — that would make the remote a build-time dependency and
 * undo federation. So the badge is fed by events, and the number here is a
 * projection of the storefront's truth, never a second copy of it.
 */
const stopUpdates = bus.on('cart:updated', ({ totalQuantity }) => {
  cartQuantity.value = totalQuantity
})

onUnmounted(stopUpdates)

/** Asks whoever owns the cart to open it. */
function requestCart(): void {
  bus.emit('cart:open-requested', { origin: 'shell-header' })
}
</script>

<template>
  <header class="flex items-center justify-between border-b border-slate-200 px-6 py-3">
    <RouterLink to="/" class="text-lg font-semibold">Sentra</RouterLink>

    <nav class="flex items-center gap-4 text-sm">
      <RouterLink to="/">Shop</RouterLink>
      <RouterLink to="/ops/orders">Ops</RouterLink>
    </nav>

    <div class="flex items-center gap-3">
      <RoleSwitcher />
      <button
        type="button"
        class="rounded border border-slate-300 px-3 py-1 text-sm"
        :aria-label="`Cart, ${cartQuantity} items`"
        @click="requestCart"
      >
        Cart ({{ cartQuantity }})
      </button>
    </div>
  </header>
</template>
