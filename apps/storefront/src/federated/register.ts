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
   * Loads whatever cart a returning shopper already has, the same load
   * `App.vue` used to trigger itself in `onMounted` before this moved here.
   * Registration is the one call site that runs in both modes, so this is
   * the only place restoration can live without either duplicating it
   * (standalone) or dropping it entirely (federated, where nothing else
   * calls it — no route view or overlay does). Symmetric with the
   * `session:changed` handler below: that one forgets a cart, this one loads
   * one, and both are store lifecycle rather than a component's concern.
   *
   * `app.runWithContext` is required here, not optional: `register` runs
   * outside any component's `setup()`, and the cart store's own `inject()`
   * call for the shell bus only resolves its default under a component
   * instance or a `runWithContext` call — see `stores/cart.ts`.
   */
  app.runWithContext(() => {
    void useCartStore().restore()
  })

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
