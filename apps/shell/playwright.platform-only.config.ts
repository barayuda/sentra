import { defineConfig, devices } from '@playwright/test'

/**
 * Platform-only browser smoke check configuration.
 *
 * `platform-only`'s CI job (`.github/workflows/ci.yml`) builds, typechecks,
 * lints and tests the stripped tree but never loads a page — see
 * `e2e/platform-only.smoke.spec.ts` for why that gap mattered in practice.
 * This config exists to run exactly that one spec against exactly the build
 * an adopter of a stripped tree is most likely to try first: the shell,
 * with `VITE_SENTRA_MOCKS=true`.
 *
 * Deliberately separate from `playwright.config.ts`: that config's
 * `hasReference` gate empties its `webServer` and ignores every spec when
 * the reference packages are absent — correct for the federated suite,
 * which has nothing to federate on a stripped tree, but exactly backwards
 * for a check whose entire point is to run on a stripped tree. Two small,
 * single-purpose configs reusing the same Playwright setup (same
 * `@playwright/test` install, same browser-install step, same webServer
 * shape) beat one config with branching that runs in opposite directions.
 *
 * The spec lives in `./e2e-platform-only`, not `./e2e`: `playwright.config.ts`
 * has no `testMatch` of its own, so on the full (non-stripped) tree it globs
 * every `*.spec.ts` under `./e2e` and would otherwise sweep this spec into
 * the federated suite too — where it would fail for the opposite reason it
 * exists, because a full tree's `remotes.json` is not empty.
 */
export default defineConfig({
  testDir: './e2e-platform-only',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    /* See `playwright.config.ts`'s identical shell entry for why the flag,
       the explicit `--host`, and `--strictPort` are all required. */
    command:
      'VITE_SENTRA_MOCKS=true pnpm --filter @sentra/shell build && pnpm --filter @sentra/shell preview --port 4175 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
