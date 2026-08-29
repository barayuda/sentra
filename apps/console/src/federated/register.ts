import type { RemoteContext } from '@sentra/shell-contract'
import { toastPlugin } from '@sentra/ui'
import type { App } from 'vue'
import { createConsoleOpsClient, opsPlugin } from '../ops.ts'

/**
 * Installs what the console's views need on a host's app.
 *
 * `ctx` is unused: the console publishes no events and reads the session
 * through `useSession()` from inside its components. The parameter stays for
 * contract conformance, prefixed to satisfy the unused-args rule.
 *
 * @param app - The host's application instance.
 * @param _ctx - See {@link RemoteContext}. Unused.
 */
export function registerConsole(app: App, _ctx: RemoteContext): void {
  app.use(toastPlugin)
  app.use(opsPlugin, createConsoleOpsClient())
}
