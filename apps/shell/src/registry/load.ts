import type { RemoteManifestEntry, RemoteModule } from '@sentra/shell-contract'

/** A remote that loaded and passed its shape check. */
export interface LoadedRemote {
  readonly status: 'loaded'
  readonly entry: RemoteManifestEntry
  readonly module: RemoteModule
}

/** A remote that did not load, or loaded something unusable. */
export interface FailedRemote {
  readonly status: 'failed'
  readonly entry: RemoteManifestEntry
  readonly reason: string
}

/** Result of attempting one remote. */
export type RemoteLoadOutcome = LoadedRemote | FailedRemote

/** Loads one remote's `./remote` export by container name. */
export type RemoteLoader = (name: string, entry: RemoteManifestEntry) => Promise<RemoteModule>

/**
 * Verifies a resolved module actually implements the contract.
 *
 * A remote is deployed independently, so its version is whatever happens to
 * be live — including one built before the contract existed. Checking here
 * turns "the ops console renders nothing and the router throws" into a named
 * failure attributed to a named remote.
 */
function conforms(module: unknown): module is RemoteModule {
  if (typeof module !== 'object' || module === null) return false
  const candidate = module as Partial<RemoteModule>
  return Array.isArray(candidate.routes) && typeof candidate.register === 'function'
}

/**
 * Loads every manifest entry, isolating failures.
 *
 * Concurrent, and `Promise.all` is safe because the per-remote body cannot
 * reject — each catch converts to a `FailedRemote`. One unreachable remote
 * must not delay or cancel the others: a serial loop would make the slowest
 * remote the shell's time-to-interactive, and `Promise.all` over throwing
 * bodies would lose every sibling to the first rejection.
 *
 * @param entries - Validated manifest entries.
 * @param loadImpl - Performs the actual federated load. Injected for tests.
 */
export async function loadRemotes(
  entries: readonly RemoteManifestEntry[],
  loadImpl: RemoteLoader,
): Promise<readonly RemoteLoadOutcome[]> {
  return Promise.all(
    entries.map(async (entry): Promise<RemoteLoadOutcome> => {
      try {
        const module = await loadImpl(entry.name, entry)
        if (!conforms(module)) {
          return {
            status: 'failed',
            entry,
            reason: 'remote loaded but does not export routes and register',
          }
        }
        return { status: 'loaded', entry, module }
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : 'unknown load failure'
        return { status: 'failed', entry, reason }
      }
    }),
  )
}
