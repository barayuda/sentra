import type { Router } from 'vue-router'
import type { AnalyticsClient } from './events.ts'

/**
 * Instruments a Vue Router instance: every completed navigation tracks a
 * `page_view` event with the destination path (without its query string) and
 * route name.
 *
 * The schema must contain `page_view: ['path', 'name']` — the client warns
 * and drops otherwise, which is the designed failure mode (visible, not
 * silent).
 *
 * @returns The unregister function from `router.afterEach`.
 */
export function instrumentRouter(router: Router, client: AnalyticsClient): () => void {
  return router.afterEach((to) => {
    /**
     * `to.path`, not `to.fullPath`. A query string is user-supplied content
     * that routinely carries search terms, emails, and tokens; sending it to
     * an analytics transport would smuggle exactly the data the allowlist in
     * `events.ts` exists to keep out. Route identity lives in `path` + `name`.
     */
    client.track('page_view', { path: to.path, name: String(to.name ?? '') })
  })
}
