<script setup lang="ts">
/**
 * The storefront's drawer, mounted by whichever host is running.
 *
 * The drawer has to outlive the storefront's own routes: a shopper on
 * `/ops/orders` who clicks the shell's cart button expects the cart, not a
 * navigation. So the drawer is not rendered by a route — it is an overlay the
 * shell keeps mounted for as long as this remote is loaded, opened by an event
 * rather than by a prop from a parent it has no relationship with.
 */
import { useShellBus } from '@sentra/shell-contract'
import { ToastHost } from '@sentra/ui'
import { onBeforeUnmount, ref } from 'vue'
import CartDrawer from '../components/CartDrawer.vue'

const open = ref(false)
const bus = useShellBus()

const stop = bus.on('cart:open-requested', () => {
  open.value = true
})

/* The subscription outlives no component: unsubscribing is what stops a
   hot-reloaded or re-registered remote from opening two drawers. */
onBeforeUnmount(stop)
</script>

<template>
  <CartDrawer v-model="open" />
  <ToastHost />
</template>
