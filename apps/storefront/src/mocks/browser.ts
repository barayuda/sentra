import {
  createMockControl,
  createStorefrontHandlers,
  type MockControl,
} from '@sentra/sdk-commerce/mocks'
import type { RequestHandler } from 'msw'
import { setupWorker } from 'msw/browser'

/**
 * The live scenario switch.
 *
 * Exposed on `window` in mock builds so a demo can induce a throttled response
 * or a network failure from the console — a failure state triggered on purpose
 * in front of an audience is far more convincing than a screenshot of one.
 */
export const mockControl: MockControl = createMockControl()

declare global {
  interface Window {
    /** Present only in mock builds. */
    sentraMocks?: MockControl
  }
}

/**
 * Starts the Service Worker and resolves once it is intercepting.
 *
 * Awaited before the app mounts: a component that fires a request before the
 * worker is ready would reach the real network and fail, intermittently and
 * only on slow machines.
 */
export async function startMockWorker(): Promise<void> {
  /**
   * `@sentra/sdk-commerce` pins `typescript@7.0.2` for its own `tsc` typecheck
   * while this package aliases `typescript` to the TS6 API for `vue-tsc` (see
   * the package manifest note on why). Because `msw` carries an *optional*
   * peer on `typescript`, pnpm's strict peer resolution gives each of those
   * two packages its own physical copy of `msw` — same published version,
   * two distinct install locations. TypeScript treats `RequestHandler` from
   * one copy as a different, unrelated class from the other because it has a
   * protected member (`resolver`), even though both classes are the literal
   * same compiled code. This is TypeScript's well-known "dual package
   * hazard"; the cast below is a type-level fix for a build-time-only
   * artifact, not a real behavioural difference at runtime.
   */
  const worker = setupWorker(
    ...(createStorefrontHandlers(mockControl) as unknown as RequestHandler[]),
  )
  await worker.start({
    /* Anything the handlers do not model should be loud, not silently passed
       through to a network the demo does not have. */
    onUnhandledRequest: 'warn',
    quiet: true,
  })
  window.sentraMocks = mockControl
}
