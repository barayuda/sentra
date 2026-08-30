import { defineConfig, devices } from '@playwright/test'

/**
 * E2E configuration.
 *
 * Runs against the **production build** served by `vite preview`, not the dev
 * server. That is the point of an E2E gate here: the dev server does not
 * exercise the built bundle, the code splitting, or the committed Service
 * Worker, and those are exactly where a build-only regression would hide.
 *
 * `VITE_SENTRA_MOCKS=true` makes the build self-contained, so this suite has no
 * network dependency — the same property the live demo relies on (spec G3).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    /**
     * `--host 127.0.0.1` is explicit rather than relying on `vite preview`'s
     * default `localhost` binding: on a dual-stack loopback, Node resolves
     * `localhost` to a single address rather than binding both, and on this
     * host that resolved to `::1` only — leaving `127.0.0.1` (this config's
     * `baseURL`) connection-refused and the webServer probe timing out.
     */
    /*
     * Under CI the workspace is already built by the job's build step, with
     * `VITE_SENTRA_MOCKS=true` set there. Rebuilding here would repeat the
     * entire build for no new information. Locally the build is kept, so
     * `pnpm e2e` still works from a cold checkout.
     */
    command: process.env.CI
      ? 'pnpm preview --port 4173 --strictPort --host 127.0.0.1'
      : 'VITE_SENTRA_MOCKS=true pnpm build && pnpm preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
