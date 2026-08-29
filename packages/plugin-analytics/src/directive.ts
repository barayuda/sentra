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
  /**
   * The stored entry holds the *latest* binding value, not a closure over the
   * binding object handed to `mounted`. Vue creates a fresh binding object per
   * update, so a listener closing over the mounted-time binding keeps firing
   * the original event name after a reactive change — the payload silently
   * goes stale while the element keeps working.
   */
  const handlers = new WeakMap<
    HTMLElement,
    { type: string; listener: EventListener; binding: TrackBinding }
  >()

  function bind(el: HTMLElement, type: string, binding: TrackBinding): void {
    /* The listener reads the stored binding at fire time rather than closing
       over the one passed here — that indirection is what keeps the payload
       fresh across updates. */
    const listener: EventListener = () => {
      const current = handlers.get(el)
      if (current) client.track(current.binding.name, current.binding.props)
    }
    handlers.set(el, { type, listener, binding })
    el.addEventListener(type, listener)
  }

  function unbind(el: HTMLElement): void {
    const entry = handlers.get(el)
    if (!entry) return
    el.removeEventListener(entry.type, entry.listener)
    handlers.delete(el)
  }

  return {
    mounted(el, binding) {
      bind(el, binding.arg ?? 'click', binding.value)
    },
    updated(el, binding) {
      const type = binding.arg ?? 'click'
      const entry = handlers.get(el)
      /* Same event type: swap the payload in place, no listener churn. */
      if (entry && entry.type === type) {
        entry.binding = binding.value
        return
      }
      /* The event argument itself changed — rebind. */
      unbind(el)
      bind(el, type, binding.value)
    },
    unmounted(el) {
      unbind(el)
    },
  }
}
