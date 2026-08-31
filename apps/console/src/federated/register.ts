import { createFlagClient, flagsPlugin } from '@sentra/flags'
import { useErrors } from '@sentra/plugin-errors'
import type { RemoteContext } from '@sentra/shell-contract'
import { toastPlugin } from '@sentra/ui'
import type { App } from 'vue'
import { CONSOLE_FLAGS, createOpsFlagSource } from '../flags.ts'
import { createConsoleOpsClient, opsPlugin, useOps } from '../ops.ts'

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

  /**
   * Retrieve the client `opsPlugin` just installed rather than constructing a
   * second one — `apps/console/src/main.ts:108-113` documents why a second
   * `createConsoleOpsClient()` here would be a discarded, wasted client.
   */
  const opsClient = app.runWithContext(() => useOps())

  /**
   * The reporter comes from whichever host mounts this remote. Under the
   * shell (`apps/shell/src/registry/boot.ts:202`), `errorsPlugin` is
   * installed with `allowedContextKeys: ['name']`, so the `view` key added
   * below is not allowlisted there and is dropped before it leaves the
   * browser — the allowlist working as designed, not a bug here. Reporting
   * the error at all still matters more than the one dropped context key, so
   * the `onError` wiring below is kept as-is; do not widen the shell's
   * allowlist to accommodate it.
   */
  const reporter = app.runWithContext(() => useErrors())

  const flags = createFlagClient({
    declarations: CONSOLE_FLAGS,
    source: createOpsFlagSource(opsClient),
    allowOverrides: import.meta.env.DEV,
    onError: (error) => reporter.report(error, { view: 'flags' }),
  })
  app.use(flagsPlugin, flags)
  void flags.refresh()
}
