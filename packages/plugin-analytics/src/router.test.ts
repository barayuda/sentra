import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAnalytics } from './events.ts'
import { instrumentRouter } from './router.ts'

const Page = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Page },
      { path: '/products', name: 'products', component: Page },
    ],
  })
}

describe('instrumentRouter', () => {
  it('tracks the route path without the query string', async () => {
    const send = vi.fn()
    const client = createAnalytics({ schema: { page_view: ['path', 'name'] }, transport: { send } })
    const router = makeRouter()
    instrumentRouter(router, client)
    await router.push('/products?q=secret-term&email=a@b.com')
    expect(send).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'page_view',
        props: { path: '/products', name: 'products' },
      }),
    ])
  })

  it('stops tracking after the returned unregister runs', async () => {
    const send = vi.fn()
    const client = createAnalytics({ schema: { page_view: ['path', 'name'] }, transport: { send } })
    const router = makeRouter()
    const stop = instrumentRouter(router, client)
    stop()
    await router.push('/products')
    expect(send).not.toHaveBeenCalled()
  })
})
