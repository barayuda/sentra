import { inject, type InjectionKey, type Plugin } from 'vue'
import type { StorefrontClient } from '../client.ts'

/**
 * Injection key for the Storefront client.
 *
 * A string-based key rather than a Symbol, matching `TOAST_INJECTION_KEY` and
 * `ANALYTICS_INJECTION_KEY`: the string is part of the public contract, so a
 * test can provide a stub client without importing this module's instance.
 */
export const STOREFRONT_INJECTION_KEY =
  'sentra:storefront' as unknown as InjectionKey<StorefrontClient>

/** Options for {@link storefrontPlugin}. */
export interface StorefrontPluginOptions {
  /** The client to provide app-wide. */
  readonly client: StorefrontClient
}

/**
 * Vue plugin: `app.use(storefrontPlugin, { client })`.
 *
 * The client is constructed by the application rather than by this plugin,
 * because only the application knows whether it is talking to Shopify or to
 * MSW fixtures — and that decision must be visible in application code, not
 * buried in a library default.
 */
export const storefrontPlugin: Plugin<[StorefrontPluginOptions]> = {
  install(app, options) {
    app.provide(STOREFRONT_INJECTION_KEY, options.client)
  },
}

/**
 * Returns the app's Storefront client.
 *
 * @throws When the plugin is not installed — the message names the fix.
 */
export function useStorefront(): StorefrontClient {
  /* A default suppresses inject()'s "not found" warning while preserving the
     throw below — the warning is noise here because the caller-facing error
     message already names the fix. */
  const client = inject(STOREFRONT_INJECTION_KEY, null)
  if (!client) {
    throw new Error('useStorefront() requires app.use(storefrontPlugin, { client }) before mount.')
  }
  return client
}
