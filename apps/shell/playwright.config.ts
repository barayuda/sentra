import { defineConfig, devices } from '@playwright/test'

/**
 * Federated E2E configuration.
 *
 * Three servers, three origins, one browser. The shell is served from 4175 and
 * fetches `remoteEntry.js` from 4173 and 4174 — which is the whole point. A
 * single-server setup would prove nothing federation-specific, because the
 * failure modes worth catching (shared-singleton mismatch, CORS, a stale
 * remote contract) only exist across a real network boundary.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      /*
       * `apps/storefront`'s `preview` script is bare `vite preview` with no
       * port flags at all, so the port and `--strictPort` are supplied here.
       * `--host 127.0.0.1` is explicit rather than relying on the default
       * `localhost` binding: on a dual-stack loopback, Node resolves
       * `localhost` to a single address, and on this host that resolves to
       * `::1` only — leaving `127.0.0.1` connection-refused and this
       * config's probe timing out. See `apps/storefront/playwright.config.ts`
       * for the same failure, documented at its source.
       */
      command:
        'VITE_SENTRA_MOCKS=true pnpm --filter @sentra/storefront build && pnpm --filter @sentra/storefront preview --port 4173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4173/remoteEntry.js',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      /* `apps/console`'s `preview` script sets `--port 4174 --strictPort` but
         no `--host`, so the same dual-stack loopback failure applies. */
      command:
        'VITE_SENTRA_MOCKS=true pnpm --filter @sentra/console build && pnpm --filter @sentra/console preview --port 4174 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4174/remoteEntry.js',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      /*
       * The shell's own build also needs `VITE_SENTRA_MOCKS=true`:
       * `mocksEnabled()` (`src/mocks/enabled.ts`) is what gates both the mock
       * worker and the `?break=<name>` control read in `registry/boot.ts`.
       * Without the flag on this build, `?break=` silently does nothing and
       * every deliberate-failure test would pass against a healthy remote.
       */
      command:
        'VITE_SENTRA_MOCKS=true pnpm --filter @sentra/shell build && pnpm --filter @sentra/shell preview --port 4175 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
