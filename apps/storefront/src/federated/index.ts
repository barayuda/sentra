import type { RemoteModule } from '@sentra/shell-contract'
import { storefrontEventSchema } from '../analytics.ts'
import CartOverlay from './CartOverlay.vue'
import { registerStorefront } from './register.ts'
import { storefrontRoutes } from './routes.ts'
import '../styles.css'

/**
 * The storefront as a federated remote.
 *
 * The default export is the whole contract with the shell — routes, the
 * overlay that outlives them, the analytics events the shell merges, and the
 * registration hook. Nothing else is exposed, so the shell cannot reach into
 * the storefront's internals and the storefront cannot accidentally become
 * part of the shell's build.
 */
const storefrontRemote = {
  routes: storefrontRoutes,
  overlay: CartOverlay,
  analyticsEvents: storefrontEventSchema,
  register: registerStorefront,
} satisfies RemoteModule

export default storefrontRemote
