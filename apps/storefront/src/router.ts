import { createRouter, createWebHistory, type Router } from 'vue-router'

/** The collection this storefront presents; matches the MSW fixtures. */
export const DEFAULT_COLLECTION_HANDLE = 'tableware'

/**
 * Application routes.
 *
 * Views are lazily imported so the product page is not in the landing page's
 * bundle — the split that makes the bundle-size gate in M5 meaningful rather
 * than decorative.
 */
export const router: Router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'collection',
      component: () => import('./views/CollectionView.vue'),
    },
    {
      path: '/products/:handle',
      name: 'product',
      component: () => import('./views/ProductView.vue'),
      props: true,
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
