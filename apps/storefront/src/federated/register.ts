import { storefrontPlugin } from '@sentra/sdk-commerce/vue'
import type { RemoteContext } from '@sentra/shell-contract'
import { toastPlugin } from '@sentra/ui'
import type { App } from 'vue'
import { useCartStore } from '../stores/cart.ts'
import { getStorefrontClient } from '../storefront.ts'

/**
 * Installs everything the storefront's views need on a host's app.
 *
 * The host holds the only `App` instance, and it must not import a commerce
 * SDK to run a commerce remote — that would make the shell's dependency graph
 * grow with every remote added, which is the coupling federation exists to
 * remove. So the remote installs its own plugins here.
 *
 * @param app - The host's application instance.
 * @param ctx - See {@link RemoteContext}.
 */
export function registerStorefront(app: App, ctx: RemoteContext): void {
  app.use(toastPlugin)
  app.use(storefrontPlugin, { client: getStorefrontClient() })

  /**
   * A cart belongs to a session. Signing out and leaving the previous
   * shopper's lines in local storage is both wrong and a small privacy
   * problem, so the remote drops the cart itself rather than hoping the shell
   * knows it should. This is why `ctx.bus` exists: the subscription has to
   * happen at registration, outside any component's setup.
   */
  ctx.bus.on('session:changed', () => {
    app.runWithContext(() => {
      void useCartStore().forget()
    })
  })
}
