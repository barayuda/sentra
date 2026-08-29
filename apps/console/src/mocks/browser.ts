import { createOpsHandlers, createOpsMockControl, type OpsMockControl } from '@sentra/sdk-ops/mocks'
import type { RequestHandler } from 'msw'
import { setupWorker } from 'msw/browser'

/** Scenario switch, exposed on `window` for E2E control. */
export const opsMockControl: OpsMockControl = createOpsMockControl()

declare global {
  interface Window {
    /** Present only in mock builds. */
    sentraOpsMocks?: OpsMockControl
  }
}

/**
 * Starts the worker and waits for it to control the page.
 *
 * Standalone only. Under the shell there is exactly one Service Worker scope,
 * so the shell installs one worker with every remote's handlers rather than
 * each remote starting its own — two `setupWorker()` calls contend and the
 * second silently wins. See Task 11.
 */
export async function startMockWorker(): Promise<void> {
  /**
   * `@sentra/sdk-ops` pins `typescript@7.0.2` for its own `tsc` typecheck
   * while this package aliases `typescript` to the TS6 API for `vue-tsc` (see
   * the package manifest note on why). Because `msw` carries an *optional*
   * peer on `typescript`, pnpm's strict peer resolution gives each of those
   * two packages its own physical copy of `msw` — same published version,
   * two distinct install locations. TypeScript treats `RequestHandler` from
   * one copy as a different, unrelated class from the other because it has a
   * protected member (`resolver`), even though both classes are the literal
   * same compiled code. This is TypeScript's well-known "dual package
   * hazard"; the cast below is a type-level fix for a build-time-only
   * artifact, not a real behavioural difference at runtime. Mirrors
   * `apps/storefront/src/mocks/browser.ts`.
   */
  const worker = setupWorker(...(createOpsHandlers(opsMockControl) as unknown as RequestHandler[]))
  await worker.start({
    /* Anything the handlers do not model should be loud, not silently passed
       through to a network the demo does not have. */
    onUnhandledRequest: 'warn',
    quiet: true,
  })
  window.sentraOpsMocks = opsMockControl
}
