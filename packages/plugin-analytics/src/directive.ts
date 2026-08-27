import type { Directive } from 'vue'
import type { AnalyticsClient, AnalyticsEventProps } from './events.ts'

/** Binding payload for `v-track`. */
export interface TrackBinding {
  name: string
  props?: AnalyticsEventProps
}

/**
 * Creates the `v-track` directive bound to a client. `v-track="{ name }"`
 * tracks on click; `v-track:submit` tracks the named DOM event instead.
 */
export function createTrackDirective(
  client: AnalyticsClient,
): Directive<HTMLElement, TrackBinding> {
  const handlers = new WeakMap<HTMLElement, { type: string; listener: EventListener }>()
  return {
    mounted(el, binding) {
      const type = binding.arg ?? 'click'
      const listener = () => client.track(binding.value.name, binding.value.props)
      handlers.set(el, { type, listener })
      el.addEventListener(type, listener)
    },
    unmounted(el) {
      const entry = handlers.get(el)
      if (entry) el.removeEventListener(entry.type, entry.listener)
    },
  }
}
