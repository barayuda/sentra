/**
 * Vitest setup for `@sentra/storefront`.
 *
 * `@testing-library/vue` normally registers its own per-test DOM cleanup by
 * checking for a global `afterEach`. `@sentra/config/vitest` sets
 * `globals: false` deliberately (explicit imports only), so that check never
 * finds one and cleanup silently never runs — a `render` call in one test
 * then leaks its DOM into the next. Registering cleanup explicitly here
 * keeps tests isolated without reintroducing implicit globals. Mirrors
 * `packages/ui/vitest.setup.ts`.
 */
import { cleanup } from '@testing-library/vue'
import { config } from '@vue/test-utils'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  /*
   * `cleanup()` unmounts, and unmounting an element that carries a leave
   * transition defers its removal by a frame rather than removing it inline.
   * `CartDrawer` wraps `Dialog`, which teleports to `document.body` — outside
   * the container `cleanup()` deletes — so that deferral outlives the test and
   * the next query finds two drawers. Clearing the body closes that window
   * synchronously, and runs after `cleanup()` so it only removes what
   * unmounting left behind. Mirrors `packages/ui/vitest.setup.ts`.
   */
  document.body.replaceChildren()
})

/**
 * Render `<Transition>` and `<TransitionGroup>` for real instead of stubbing
 * them.
 *
 * Vue Test Utils replaces both with a `<transition-stub>` **element** by
 * default. That element is not transparent: it becomes a real node in the
 * tree, so a transitioned child's `parentElement` is the stub rather than the
 * element the component actually nests it inside — which silently invalidates
 * any assertion made through `parentElement`, including this suite's
 * drawer-placement checks. Mirrors `packages/ui/vitest.setup.ts`, where the
 * full reasoning lives.
 */
config.global.stubs = { ...config.global.stubs, transition: false, 'transition-group': false }

/**
 * happy-dom does not run layout: every element's `offsetHeight`/`offsetWidth`
 * is a hardcoded 0 (there is no box model to measure). `@tanstack/vue-virtual`
 * measures its scroll viewport through exactly those two properties
 * (`getRect` in `@tanstack/virtual-core`), and it does so *synchronously* the
 * moment it attaches to a scroll element — which happens during the very
 * first render, before any test assertion runs. That synchronous zero
 * measurement permanently overwrites the virtualizer's `initialRect` seed
 * (real `??` fallback semantics: once `scrollRect` holds a `{width:0,
 * height:0}` object it is no longer `null`/`undefined`, so the seed is never
 * consulted again), which makes `calculateRange` treat the viewport as
 * zero-height and render no rows at all.
 *
 * A synchronous assertion made immediately after `render()` never observes
 * this: the corrective (bad) measurement is applied via a post-render effect
 * that Vue flushes on the next reactivity tick, so it lands after the
 * assertion has already run against the correct first-pass DOM. Any
 * assertion that awaits so much as a microtask — `rerender()`, `findByText`,
 * `waitFor`, a real `nextTick()` — does observe it, and sees a permanently
 * empty table. This is the actual cause of `DataTable`'s "rows arrive after
 * mount" regression (see `DataTable.vue`'s top-level doc comment) and,
 * unverified but almost certainly, `ProductGrid`'s equivalent one parked
 * during M3.
 *
 * Rather than fake layout everywhere, this stub reports the element's own
 * inline pixel height/width back through `offsetHeight`/`offsetWidth` when
 * one is set (as `DataTable`'s scroll viewport does via `:style="{ height:
 * ... }"`), and leaves happy-dom's honest 0 for every element that has none.
 * Mirrors `packages/ui/vitest.setup.ts`.
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
