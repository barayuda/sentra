import type { Session } from '@sentra/shell-contract'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { createRoleGuard } from './guards.ts'

const Blank = { template: '<div />' }

const ROUTES: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: Blank },
  { path: '/ops', name: 'ops', component: Blank, meta: { requiresRole: 'ops' } },
  { path: '/forbidden', name: 'forbidden', component: Blank },
]

function routerWith(session: Session | null) {
  const router = createRouter({ history: createMemoryHistory(), routes: ROUTES })
  router.beforeEach(createRoleGuard(() => session))
  return router
}

const OPS: Session = { id: 'u', displayName: 'U', role: 'ops' }
const SHOPPER: Session = { id: 'u', displayName: 'U', role: 'shopper' }

describe('createRoleGuard', () => {
  it('lets an unrestricted route through', async () => {
    const router = routerWith(SHOPPER)
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('lets the required role through', async () => {
    const router = routerWith(OPS)
    await router.push('/ops')
    expect(router.currentRoute.value.name).toBe('ops')
  })

  it('redirects a wrong-role visitor to forbidden', async () => {
    const router = routerWith(SHOPPER)
    await router.push('/ops')
    expect(router.currentRoute.value.name).toBe('forbidden')
  })

  it('records where the visitor was headed', async () => {
    const router = routerWith(SHOPPER)
    await router.push('/ops')
    expect(router.currentRoute.value.query.from).toBe('/ops')
  })

  it('redirects when there is no session at all', async () => {
    const router = routerWith(null)
    await router.push('/ops')
    expect(router.currentRoute.value.name).toBe('forbidden')
  })

  it('does not loop when the forbidden route itself is visited', async () => {
    const router = routerWith(SHOPPER)
    await router.push('/forbidden')
    expect(router.currentRoute.value.name).toBe('forbidden')
  })

  /*
   * Correction 10: the case above (a *valid* `shopper` session visiting
   * `/forbidden`) is weak — `/forbidden` carries no `requiresRole`, so
   * `if (!required) return true` fires before the session is ever read, and
   * almost any implementation — including one that reads the session before
   * checking `required` — would still need to actually redirect somewhere to
   * fail this assertion in an observable way for a *valid* session. The state
   * that actually produces an infinite redirect loop is no session at all: a
   * guard that checks `session === null` before `required` would redirect
   * `/forbidden` back to itself forever. This case is the one that catches
   * that ordering bug.
   */
  it('settles on forbidden when there is no session and forbidden itself is visited', async () => {
    const router = routerWith(null)
    await router.push('/forbidden')
    expect(router.currentRoute.value.name).toBe('forbidden')
  })
})
