/**
 * Fallback type declarations for the reference SDKs' mock subpaths.
 *
 * `mocks/browser.ts` imports `@sentra/sdk-commerce/mocks` and
 * `@sentra/sdk-ops/mocks` to assemble the platform's single mock Service
 * Worker (see that file for why). Both packages carry `sentra.role: "reference"`
 * and are deleted by `scripts/strip-reference.mjs`, so on a platform-only tree
 * TypeScript cannot resolve them at all — real module resolution always wins
 * when the package is actually installed, so these declarations only take
 * effect on the stripped tree, where vue-tsc would otherwise fail the whole
 * program over two dev-only mock imports.
 */
declare module '@sentra/sdk-commerce/mocks' {
  export interface MockControl {
    [key: string]: unknown
  }
  export function createMockControl(): MockControl
  export function createStorefrontHandlers(control: MockControl): unknown[]
}

declare module '@sentra/sdk-ops/mocks' {
  export interface OpsMockControl {
    [key: string]: unknown
  }
  export function createOpsMockControl(): OpsMockControl
  export function createOpsHandlers(control: OpsMockControl): unknown[]
}
