import type { Router } from 'vue-router'
import type { AnalyticsClient } from './events.ts'

/**
 * Instruments a Vue Router instance: every completed navigation tracks a
 * `page_view` event with the destination path and route name.
 *
 * The schema must contain `page_view: ['path', 'name']` — the client warns
 * and drops otherwise, which is the designed failure mode (visible, not
 * silent).
 *
 * @returns The unregister function from `router.afterEach`.
 */
export function instrumentRouter(router: Router, client: AnalyticsClient): () => void {
  return router.afterEach((to) => {
    client.track('page_view', { path: to.fullPath, name: String(to.name ?? '') })
  })
}
