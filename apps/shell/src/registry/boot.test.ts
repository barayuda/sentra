import { ok } from '@sentra/result'
import type { RemoteModule } from '@sentra/shell-contract'
import { cleanup } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { bootShell } from './boot.ts'

const { mockLoadRemote, mockRegisterRemotes, mockFetchRemoteManifest } = vi.hoisted(() => ({
  mockLoadRemote: vi.fn(),
  mockRegisterRemotes: vi.fn(),
  mockFetchRemoteManifest: vi.fn(),
}))

vi.mock('@module-federation/runtime', () => ({
  loadRemote: mockLoadRemote,
  registerRemotes: mockRegisterRemotes,
}))

/* `./manifest.ts` is this directory's own wrapper (`fetchRemoteManifest`),
   not `@sentra/shell-contract`'s parser — mocking it skips the network
   entirely rather than faking a `fetch`. */
vi.mock('./manifest.ts', () => ({
  fetchRemoteManifest: mockFetchRemoteManifest,
}))

const ENTRIES = [
  { name: 'storefront', entry: 'http://localhost:4173/remoteEntry.js', basePath: '/shop' },
  { name: 'console', entry: 'http://localhost:4174/remoteEntry.js', basePath: '/ops' },
]

/* A render function, not `{ template: '<div />' }` — the same reason
   `boot.ts`'s own `REMOTE_HOST` uses one: Vite (and Vitest, which shares its
   resolution) resolves `vue` to the runtime-only build for bundler targets,
   which has no template compiler. */
const WORKING_MODULE: RemoteModule = {
  routes: [{ path: '', component: { render: () => h('div', 'storefront ok') } }],
  register: () => undefined,
}

/**
 * Boots the shell against a fixed two-remote manifest where `console`
 * always fails to load and `storefront` always loads, with the address bar
 * pre-set to `path` before `bootShell()` builds its router. `path` is what
 * lets each test control whether the route showing when the boot-time
 * failure is published is `console`'s own `RemoteUnavailable` fallback or
 * something else entirely.
 */
async function bootAt(path: string): Promise<void> {
  window.history.replaceState(null, '', path)
  mockRegisterRemotes.mockImplementation(() => undefined)
  mockFetchRemoteManifest.mockResolvedValue(ok({ entries: ENTRIES, rejected: [] }))
  mockLoadRemote.mockImplementation(async (containerAndExport: string) => {
    const [name] = containerAndExport.split('/')
    if (name === 'console') throw new Error('remoteEntry.js: 404 (simulated)')
    return { default: WORKING_MODULE }
  })
  await bootShell()
}

describe('bootShell — remote:failed toast subscriber', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('toasts a boot-time failure for a remote whose route is not the one showing', async () => {
    await bootAt('/shop')
    const alerts = document.body.querySelectorAll('[role="alert"]')
    /*
     * `/shop` resolves to storefront's own route, not console's
     * `RemoteUnavailable` fallback (`/ops/**`), so nothing else on the page
     * has any reason to mention console. The only thing that can produce a
     * `role="alert"` element naming console here is the toast — deleting
     * `bus.on('remote:failed', ...)` from `boot.ts` leaves zero alerts and
     * fails this assertion; a test that only asserted the bus *emitted* the
     * event would not have caught that.
     */
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toContain('console is unavailable')
  })

  it('does not also toast when the current route is that remote’s own RemoteUnavailable page', async () => {
    await bootAt('/ops/orders')
    const alerts = document.body.querySelectorAll('[role="alert"]')
    /*
     * Console's own fallback route is what is showing here, and it already
     * renders "console is unavailable" via `RemoteUnavailable`. A toast
     * repeating the identical failure in the identical words would be a
     * second, redundant alert for the one person who least needs a second
     * signal — they are already looking straight at the explanation.
     */
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toContain('console is unavailable')
  })
})
