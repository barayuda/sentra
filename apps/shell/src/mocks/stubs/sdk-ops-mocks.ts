import type { RequestHandler } from 'msw'

/**
 * Platform-only stand-in for `@sentra/sdk-ops/mocks`.
 *
 * `scripts/strip-reference.mjs` deletes `packages/sdk-ops` — it carries
 * `sentra.role: "reference"`. `src/mocks/browser.ts` statically imports this
 * subpath to assemble the shell's single mock Service Worker. On a stripped
 * tree the real package is gone, so `vite.config.ts` aliases the specifier
 * here instead of externalizing it — see the sibling
 * `sdk-commerce-mocks.ts` for the full reasoning (an externalized specifier
 * builds green and then fails to resolve in the browser the instant mocks
 * are enabled).
 *
 * Do not delete this file for looking unused — it is reachable only through
 * `vite.config.ts`'s `resolve.alias`, itself conditional on the reference
 * SDKs being absent from disk.
 *
 * The shape below mirrors the real `@sentra/sdk-ops/mocks` exports
 * (`OpsMockControl`, `createOpsMockControl`, `createOpsHandlers`) so this
 * stub and the ambient fallback types in `../reference-sdks.d.ts` never
 * disagree with each other or with the real module.
 */
export type OpsMockScenario = 'ok' | 'network' | 'auth' | 'validation' | 'schema_drift'

/** Mirrors the real `OpsMockControl` shape; `scenario` is inert here since there are no handlers to switch. */
export interface OpsMockControl {
  scenario: OpsMockScenario
  latencyMs: number
}

/** Mirrors the real `createOpsMockControl`'s default happy-path control. */
export function createOpsMockControl(): OpsMockControl {
  return { scenario: 'ok', latencyMs: 0 }
}

/** No reference ops console to mock, so no handlers — an empty MSW handler set is intentional, not an omission. */
export function createOpsHandlers(
  _control: OpsMockControl = createOpsMockControl(),
): RequestHandler[] {
  return []
}
