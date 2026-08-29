<script setup lang="ts">
import { useAnalytics } from '@sentra/plugin-analytics'
import type { FeatureFlag, OpsError } from '@sentra/sdk-ops'
import { Checkbox } from '@sentra/ui'
import { ref, shallowRef } from 'vue'
import { useOps } from '../ops.ts'

const ops = useOps()
const analytics = useAnalytics()

const flags = ref<FeatureFlag[]>([])
const error = shallowRef<OpsError | null>(null)
const loading = ref(false)
/** Keys with a write in flight, so a second click cannot race the first. */
const pending = ref(new Set<string>())

/** Loads every flag. */
async function load(): Promise<void> {
  loading.value = true
  const result = await ops.listFlags()
  loading.value = false
  if (!result.ok) {
    error.value = result.error
    return
  }
  error.value = null
  flags.value = [...result.value]
}

/**
 * Toggles one flag optimistically.
 *
 * The checkbox moves before the request is sent, because a toggle that waits
 * for a round trip feels broken. The write is therefore only *provisionally*
 * true, and a failure must put the switch back — otherwise the console shows
 * a state the server does not have, which for a feature flag means an
 * operator believes something is live when it is not.
 *
 * @param flag - The flag to toggle.
 */
async function toggle(flag: FeatureFlag): Promise<void> {
  if (pending.value.has(flag.key)) return
  const index = flags.value.findIndex((candidate) => candidate.key === flag.key)
  if (index === -1) return
  const previous = flag.enabled
  const next = !previous

  flags.value = flags.value.map((candidate, position) =>
    position === index ? { ...candidate, enabled: next } : candidate,
  )
  pending.value = new Set(pending.value).add(flag.key)

  const result = await ops.setFlag({ key: flag.key, enabled: next })

  const remaining = new Set(pending.value)
  remaining.delete(flag.key)
  pending.value = remaining

  if (!result.ok) {
    flags.value = flags.value.map((candidate, position) =>
      position === index ? { ...candidate, enabled: previous } : candidate,
    )
    error.value = result.error
    analytics.track('ops_error', { kind: result.error.kind })
    return
  }
  error.value = null
  flags.value = flags.value.map((candidate, position) =>
    position === index ? result.value : candidate,
  )
  analytics.track('ops_flag_toggled', { key: flag.key, enabled: next })
}

void load()
</script>

<template>
  <section class="p-6">
    <h1 class="mb-4 text-xl font-semibold">Feature flags</h1>

    <p
      v-if="error"
      role="alert"
      class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      {{ error.message }}
    </p>

    <p v-if="loading" class="text-sm text-slate-500">Loading…</p>

    <ul class="space-y-3">
      <li v-for="flag in flags" :key="flag.key" class="flex items-center gap-3">
        <Checkbox
          :label="flag.label"
          :model-value="flag.enabled"
          :disabled="pending.has(flag.key)"
          @update:model-value="toggle(flag)"
        />
        <span class="text-sm text-slate-500">{{ flag.enabled ? 'On' : 'Off' }}</span>
      </li>
    </ul>
  </section>
</template>
