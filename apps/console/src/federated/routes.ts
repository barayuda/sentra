import type { RouteRecordRaw } from 'vue-router'

/**
 * The console's routes, relative to the host's `basePath`.
 *
 * The bare index redirects to `orders` and **also carries `requiresRole`**.
 * A redirect resolves during route matching, before `beforeEach` runs, so an
 * index without the requirement would let an unauthorised visitor observe the
 * redirect target — leaking that `/ops/orders` exists and what it is called.
 *
 * The flags route arrives in Task 9.
 */
export const consoleRoutes: readonly RouteRecordRaw[] = [
  { path: '', redirect: { name: 'ops-orders' }, meta: { requiresRole: 'ops' } },
  {
    path: 'orders',
    name: 'ops-orders',
    component: () => import('../views/OrdersView.vue'),
    meta: { requiresRole: 'ops' },
  },
]
