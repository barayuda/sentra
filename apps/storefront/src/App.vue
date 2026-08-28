<script setup lang="ts">
import { ToastHost } from '@sentra/ui'
import AppHeader from './components/AppHeader.vue'

/**
 * Application shell. Cart state and the drawer arrive in Task 13; until then
 * the header reports an empty cart and the button is inert.
 */
</script>

<template>
  <div class="min-h-dvh bg-neutral-100">
    <AppHeader :item-count="0" />
    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>
