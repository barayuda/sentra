import type { RemoteModule } from '@sentra/shell-contract'
import { consoleEventSchema } from '../analytics.ts'
import { registerConsole } from './register.ts'
import { consoleRoutes } from './routes.ts'
import '../styles.css'

/**
 * The console as a federated remote.
 *
 * The default export is the whole contract with the shell — routes, the
 * analytics events the shell merges, and the registration hook. There is no
 * `overlay`: the console contributes no drawer or modal that must outlive its
 * own routes. Nothing else is exposed, so the shell cannot reach into the
 * console's internals and the console cannot accidentally become part of the
 * shell's build.
 */
const consoleRemote = {
  routes: consoleRoutes,
  analyticsEvents: consoleEventSchema,
  register: registerConsole,
} satisfies RemoteModule

export default consoleRemote
