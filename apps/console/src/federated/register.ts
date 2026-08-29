import type { RemoteContext } from '@sentra/shell-contract'
import { toastPlugin } from '@sentra/ui'
import type { App } from 'vue'
import { createConsoleOpsClient, opsPlugin } from '../ops.ts'

/**
 * Installs what the console's views need on a host's app.
 *
 * `ctx` is unused: the console does not yet publish or subscribe to any
 * shell-bus event, and none of its views read `RemoteContext`. The parameter
 * stays for contract conformance, prefixed to satisfy the unused-args rule.
 *
 * @param app - The host's application instance.
 * @param _ctx - See {@link RemoteContext}. Unused.
 */
export function registerConsole(app: App, _ctx: RemoteContext): void {
  app.use(toastPlugin)
  app.use(opsPlugin, createConsoleOpsClient())
}
