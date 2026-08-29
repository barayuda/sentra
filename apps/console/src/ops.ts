import { createOpsClient, type OpsClient } from '@sentra/sdk-ops'
import { MOCK_OPS_TOKEN, OPS_MOCK_BASE_URL } from '@sentra/sdk-ops/mocks'
import { inject, type InjectionKey, type Plugin } from 'vue'

/** Injection key for the ops client. A namespaced string — see ADR 0005. */
export const OPS_INJECTION_KEY = 'sentra:ops' as unknown as InjectionKey<OpsClient>

/** Installs an ops client app-wide. */
export const opsPlugin: Plugin<[OpsClient]> = {
  install(app, client) {
    app.provide(OPS_INJECTION_KEY, client)
  },
}

/**
 * Reads the ops client from a component's setup.
 *
 * Throws when absent, with a message naming the fix. A view that renders
 * orders is broken without a client, and returning a stub would produce an
 * empty table that looks like "no orders" rather than a misconfiguration.
 */
export function useOps(): OpsClient {
  const client = inject(OPS_INJECTION_KEY, null)
  if (!client) {
    throw new Error('[sentra] no ops client available — install opsPlugin with createOpsClient()')
  }
  return client
}

/**
 * Builds the console's client.
 *
 * The base URL and token come from the mock service, because M4 has no real
 * ops backend and inventing environment variables for one would be scaffolding
 * for a system that does not exist. `MOCK_OPS_TOKEN` is a fixed placeholder,
 * not a credential.
 */
export function createConsoleOpsClient(): OpsClient {
  return createOpsClient({ baseUrl: OPS_MOCK_BASE_URL, token: MOCK_OPS_TOKEN })
}
