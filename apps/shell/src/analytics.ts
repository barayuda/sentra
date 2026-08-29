import { batchTransport, consoleTransport, type Transport } from '@sentra/plugin-analytics'

/**
 * Builds the shell's analytics transport.
 *
 * The shell installs the *one* analytics client the whole platform shares —
 * see `registry/schema.ts`'s `mergeEventSchemas` — so it owns the transport
 * too. Batched over a console sink, mirroring
 * `apps/storefront/src/analytics.ts` and `apps/console/src/analytics.ts`: a
 * real deployment swaps the inner transport for `beaconTransport(url)`
 * without touching a call site.
 */
export function createShellAnalyticsTransport(): Transport {
  return batchTransport(consoleTransport(), { maxSize: 20, flushMs: 5000 })
}
