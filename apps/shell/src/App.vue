<script setup lang="ts">
import { ToastHost } from '@sentra/ui'
import { inject } from 'vue'
import { RouterView } from 'vue-router'
import ShellHeader from './components/ShellHeader.vue'
import { REMOTE_OVERLAYS_INJECTION_KEY } from './remote-overlays.ts'

const overlays = inject(REMOTE_OVERLAYS_INJECTION_KEY, [])
</script>

<template>
  <div class="min-h-dvh bg-neutral-100">
    <ShellHeader />
    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
    <component :is="overlay" v-for="(overlay, index) in overlays" :key="index" />
    <ToastHost />
  </div>
</template>
