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
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
