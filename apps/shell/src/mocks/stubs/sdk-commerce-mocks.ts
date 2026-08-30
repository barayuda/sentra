import type { RequestHandler } from 'msw'

/**
 * Platform-only stand-in for `@sentra/sdk-commerce/mocks`.
 *
 * `scripts/strip-reference.mjs` deletes `packages/sdk-commerce` — it carries
 * `sentra.role: "reference"`. `src/mocks/browser.ts` statically imports this
 * subpath to assemble the shell's single mock Service Worker (see that file
 * for why the shell, not each remote, owns the worker). On a stripped tree
 * the real package is gone, so `vite.config.ts` aliases the specifier here
 * instead of externalizing it: externalizing produces a build that succeeds
 * and then fails in the browser the instant `VITE_SENTRA_MOCKS=true` is set,
 * because a bare specifier like `@sentra/sdk-ops/mocks` cannot be resolved
 * by the browser at runtime — see the CI review that caught this. Aliasing
 * to an empty handler set keeps the behaviour coherent instead: a
 * platform-only tree with mocks enabled starts MSW with only the platform's
 * own handlers, because the reference handlers are legitimately absent —
 * there is no reference storefront left to mock.
 *
 * Do not delete this file for looking unused — it is reachable only through
 * `vite.config.ts`'s `resolve.alias`, itself conditional on the reference
 * SDKs being absent from disk, so normal `grep`-for-imports will not find a
 * static reference to this path.
 *
 * The shape below mirrors the real `@sentra/sdk-commerce/mocks` exports
 * (`MockControl`, `createMockControl`, `createStorefrontHandlers`) so this
 * stub and the ambient fallback types in `../reference-sdks.d.ts` never
 * disagree with each other or with the real module.
 */
export type MockScenario = 'ok' | 'throttled' | 'network' | 'user_error' | 'schema_drift'

/** Mirrors the real `MockControl` shape; `scenario` is inert here since there are no handlers to switch. */
export interface MockControl {
  scenario: MockScenario
  latencyMs: number
}

/** Mirrors the real `createMockControl`'s default happy-path control. */
export function createMockControl(): MockControl {
  return { scenario: 'ok', latencyMs: 0 }
}

/** No reference storefront to mock, so no handlers — an empty MSW handler set is intentional, not an omission. */
export function createStorefrontHandlers(
  _control: MockControl = createMockControl(),
): RequestHandler[] {
  return []
}
