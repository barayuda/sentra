<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-dvh bg-neutral-100">
    <header class="border-b border-neutral-300 bg-white px-4 py-3">
      <h1 class="text-lg font-semibold text-neutral-900">Sentra Console</h1>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
