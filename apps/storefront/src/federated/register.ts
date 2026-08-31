import { I18N_INJECTION_KEY } from '@sentra/i18n'
import { useErrors } from '@sentra/plugin-errors'
import { storefrontPlugin } from '@sentra/sdk-commerce/vue'
import type { RemoteContext } from '@sentra/shell-contract'
import { toastPlugin } from '@sentra/ui'
import type { App } from 'vue'
import { createStorefrontI18n } from '../i18n/index.ts'
import { syncDocumentLang, type SupportedLocale } from '../i18n/locale.ts'
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
   * The host hands every remote its own app instance
   * (`apps/shell/src/registry/boot.ts:223`), not a fresh one, so a remote
   * that skips its own i18n install renders under whatever the host already
   * provided — the shell installs `@sentra/ui`'s catalogue only, which has no
   * `storefront.*` keys, and `useI18n()` never throws, so the gap surfaces
   * only as raw catalogue keys in the accessible name of every translated
   * control. `createStorefrontI18n` is the same construction `main.ts` uses,
   * so the standalone and federated experiences cannot drift apart.
   *
   * `app.provide` here, never `app.use(i18nPlugin, …)`: the host has already
   * called `app.use(i18nPlugin, …)` for its own instance by the time a remote
   * registers, and Vue's `app.use` is a no-op on a plugin already installed
   * on that `app` — a second `app.use` call would silently do nothing.
   * `app.provide` has no such guard; it simply replaces whichever instance
   * was provided at this key before. That is safe here only because
   * `appMessages` (`../i18n/index.ts`) is `mergeMessages(uiMessages,
   * storefrontMessages)`, a strict superset of what the host installed — so
   * overriding the host's instance for the whole app loses no `ui.*` key that
   * anything else, including a sibling remote, was relying on.
   *
   * `useErrors()` resolves the reporter `errorsPlugin` already provided on
   * this same app — `apps/shell/src/registry/boot.ts` installs it before the
   * registration loop runs — rather than constructing a second, disconnected
   * one.
   */
  const reporter = app.runWithContext(() => useErrors())
  const i18n = createStorefrontI18n(reporter)
  syncDocumentLang(i18n.locale.value as SupportedLocale)
  app.provide(I18N_INJECTION_KEY, i18n)

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
