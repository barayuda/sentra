import { inject, type InjectionKey, type Plugin } from 'vue'
import { createToastService, type ToastService } from './service.ts'

/**
 * Injection key for the toast service. A string-based key (rather than a
 * Symbol) so tests can provide a service without importing this module's
 * instance — the string is part of the public contract.
 */
export const TOAST_INJECTION_KEY = 'sentra:toast' as unknown as InjectionKey<ToastService>

/**
 * Vue plugin installing the toast system: `app.use(toastPlugin)` creates one
 * service per app and provides it app-wide. Place `<ToastHost />` once near
 * the app root to render the queue.
 */
export const toastPlugin: Plugin = {
  install(app) {
    app.provide(TOAST_INJECTION_KEY, createToastService())
  },
}

/**
 * Returns the app's toast service.
 *
 * @throws When the plugin is not installed — the message names the fix.
 */
export function useToast(): ToastService {
  const service = inject(TOAST_INJECTION_KEY)
  if (!service) {
    throw new Error('useToast() requires app.use(toastPlugin) before mount.')
  }
  return service
}
