import { createOpsHandlers, createOpsMockControl, type OpsMockControl } from '@sentra/sdk-ops/mocks'
import {
  createMockControl,
  createStorefrontHandlers,
  type MockControl,
} from '@sentra/sdk-commerce/mocks'
import type { RequestHandler } from 'msw'
import { setupWorker } from 'msw/browser'

/**
 * One worker for the whole platform.
 *
 * A page has exactly one Service Worker registration per scope, so two
 * remotes each calling `setupWorker()` do not compose — the second
 * registration replaces the first's handlers and the first remote's requests
 * fall through to the network. The shell therefore owns the worker and
 * assembles handlers from each SDK's mock package.
 *
 * The handler factories come from the SDK packages rather than from the
 * remotes' federated modules: mocks are a development concern of the host,
 * and routing them over the federation boundary would make a dev-only
 * artifact part of the production contract.
 */
export const storefrontMockControl: MockControl = createMockControl()
export const opsMockControl: OpsMockControl = createOpsMockControl()

/**
 * `@sentra/sdk-commerce` and `@sentra/sdk-ops` each pin `typescript@7.0.2`
 * for their own `tsc` typecheck while this app aliases `typescript` to the
 * TS6 API for `vue-tsc`. Because `msw` carries an *optional* peer on
 * `typescript`, pnpm's strict peer resolution gives each of those packages
 * its own physical copy of `msw` — same published version, distinct install
 * locations — so TypeScript treats `RequestHandler` from one copy as
 * unrelated to the other. The cast below is the same type-level fix
 * `apps/storefront/src/mocks/browser.ts` and `apps/console/src/mocks/browser.ts`
 * already apply; it changes nothing at runtime.
 */
const worker = setupWorker(
  ...(createStorefrontHandlers(storefrontMockControl) as unknown as RequestHandler[]),
  ...(createOpsHandlers(opsMockControl) as unknown as RequestHandler[]),
)

/**
 * Starts the aggregated worker.
 *
 * `onUnhandledRequest` is `'bypass'` here, not `'warn'`: the shell
 * legitimately fetches `remotes.json` and two `remoteEntry.js` bundles, and
 * warning on each would train everyone to ignore the warnings.
 */
export async function startShellMocks(): Promise<void> {
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}
