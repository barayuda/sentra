import type { RouteRecordRaw } from 'vue-router'

/** The collection this storefront presents; matches the MSW fixtures. */
export const DEFAULT_COLLECTION_HANDLE = 'tableware'

/**
 * The storefront's routes, relative to whatever base the host mounts them at.
 *
 * `''` rather than `'/'`, and `'products/:handle'` rather than
 * `'/products/:handle'`: a leading slash makes a child route absolute in
 * vue-router, which would plant the storefront at the site root no matter
 * what `basePath` the manifest gave it — and would silently collide with
 * another remote. The shell refuses an absolute path at registration.
 *
 * Views are lazily imported so the product page is not in the landing page's
 * bundle — the split that makes the bundle-size gate in M5 meaningful rather
 * than decorative.
 */
export const storefrontRoutes: readonly RouteRecordRaw[] = [
  {
    path: '',
    name: 'collection',
    component: () => import('../views/CollectionView.vue'),
  },
  {
    path: 'products/:handle',
    name: 'product',
    component: () => import('../views/ProductView.vue'),
    props: true,
  },
]
