/**
 * Vitest setup for `@sentra/console`.
 *
 * `@testing-library/vue` normally registers its own per-test DOM cleanup by
 * checking for a global `afterEach`. `@sentra/config/vitest` sets
 * `globals: false` deliberately (explicit imports only), so that check never
 * finds one and cleanup silently never runs — a `render` call in one test
 * then leaks its DOM into the next. Registering cleanup explicitly here
 * keeps tests isolated without reintroducing implicit globals. Mirrors
 * `apps/storefront/vitest.setup.ts` and `packages/ui/vitest.setup.ts`.
 */
import { cleanup } from '@testing-library/vue'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

/**
 * happy-dom hardcodes every element's `offsetHeight`/`offsetWidth` to 0 (no
 * layout engine). `@sentra/ui`'s `DataTable` — which `OrdersView` renders —
 * uses `@tanstack/vue-virtual`, whose scroll-viewport measurement reads
 * exactly those two properties and, once it takes that zero-size reading,
 * never falls back to its `initialRect` seed again. Any test that awaits a
 * reactivity flush after an async populate (this suite's `findByText` calls,
 * matching `OrdersView`'s real fetch-then-render flow) observes the
 * corrupted zero-height viewport and sees no rows at all. See
 * `packages/ui/vitest.setup.ts` for the full root-cause writeup; this is the
 * same stub, required again here because it is a per-package test-runner
 * concern, not something `@sentra/ui` can fix on behalf of its consumers.
 */
function pxToNumber(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return pxToNumber(this.style.height)
  },
})

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get(this: HTMLElement) {
    return pxToNumber(this.style.width)
  },
})
