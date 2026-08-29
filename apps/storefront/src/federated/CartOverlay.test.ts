import { ANALYTICS_INJECTION_KEY, type AnalyticsClient } from '@sentra/plugin-analytics'
import { createShellBus, shellBusPlugin } from '@sentra/shell-contract'
import { toastPlugin } from '@sentra/ui'
import { DOMWrapper, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import CartOverlay from './CartOverlay.vue'

/*
 * `@pinia/testing` is not a devDependency of this package. The neighbouring
 * component tests (e.g. `CartDrawer.test.ts`) rely on `setActivePinia` plus a
 * plain `createPinia()` instead, so this file matches that harness rather
 * than adding a dependency for one test file.
 */
beforeEach(() => {
  setActivePinia(createPinia())
})

/**
 * A no-op analytics client, matching `CartDrawer.test.ts`'s
 * `recordingAnalytics()` shape. `CartDrawer` (rendered inside the overlay)
 * calls `useAnalytics()` unconditionally, so mounting the overlay in
 * isolation needs one provided even though this suite makes no assertion on
 * tracked events.
 */
function stubAnalytics(): AnalyticsClient {
  return { track: () => {}, flush: () => {} }
}

/** Mounts the overlay with the bus plus the other plugins `CartDrawer` needs. */
function mountOverlay(bus: ReturnType<typeof createShellBus>) {
  return mount(CartOverlay, {
    global: {
      plugins: [[shellBusPlugin, bus], toastPlugin],
      provide: { [ANALYTICS_INJECTION_KEY as unknown as string]: stubAnalytics() },
    },
  })
}

/*
 * `CartDrawer` renders `Dialog`, which teleports its content to
 * `document.body` (real, unstubbed Teleport) once mounted, so it never
 * appears under `wrapper.element`'s own subtree — `wrapper.find` cannot see
 * it. Querying `document.body` through a `DOMWrapper` is the fix; the
 * selector itself is exactly what the brief asked for, confirmed against
 * `Dialog.vue`'s template (`role="dialog"` on the panel).
 */
function findDialog(): ReturnType<DOMWrapper<Element>['find']> {
  return new DOMWrapper(document.body).find('[role="dialog"]')
}

describe('CartOverlay', () => {
  it('opens the drawer when the bus asks for it', async () => {
    const bus = createShellBus()
    const wrapper = mountOverlay(bus)
    expect(findDialog().exists()).toBe(false)

    bus.emit('cart:open-requested', { origin: 'test' })
    await wrapper.vm.$nextTick()

    expect(findDialog().exists()).toBe(true)
  })

  it('stops listening once unmounted', () => {
    const bus = createShellBus()
    const wrapper = mountOverlay(bus)
    wrapper.unmount()
    expect(() => bus.emit('cart:open-requested', { origin: 'test' })).not.toThrow()
  })
})
