import type { FlagContext, FlagSource, FlagValues } from './types.ts'

/**
 * Resolves `values` unchanged, ignoring `context`. The trivial `FlagSource`
 * for tests, local development, and any deployment with no flag backend at
 * all — declared defaults plus a static override map.
 */
export function staticSource(values: FlagValues): FlagSource {
  return {
    async load(_context: FlagContext): Promise<FlagValues> {
      return values
    },
  }
}

/**
 * Fetches `url` and parses the JSON body as {@link FlagValues}.
 *
 * Throws when the response is not `ok` — a 500 body parsed as JSON would
 * otherwise be adopted by `createFlagClient`'s `refresh()` as a genuine
 * snapshot of nonsense. A network-level failure (no response at all)
 * propagates from `fetch` itself, unchanged. Either way, `httpSource` never
 * swallows the failure; `refresh()` is what turns it into `onError` plus a
 * kept last-good snapshot.
 *
 * No timeout is set here. A request that hangs rather than failing never
 * settles, so a client whose only source has hung leaves `ready` at `false`
 * — the one outage a `v-if="ready"` guard does not survive. A deployment
 * that needs a deadline writes its own `FlagSource` around `fetch` with an
 * `AbortSignal`; `FlagSource` is the seam for exactly that, which is why
 * this function takes only a URL.
 */
export function httpSource(url: string): FlagSource {
  return {
    async load(_context: FlagContext): Promise<FlagValues> {
      const response = await fetch(url)
      if (!response.ok) {
        /**
         * A fresh, generic message — never `url` or the response body.
         *
         * This error reaches `createFlagClient`'s `onError`, which the
         * platform's own demonstrated pattern (`apps/console/src/main.ts`)
         * routes into `@sentra/plugin-errors`. `redact()`'s `QUERY` pattern
         * would strip a `?token=…` query string, but ADR 0012 labels
         * `redact()` best-effort, not structural, and a token embedded in a
         * path segment is not caught by it at all. `@sentra/flags` must not
         * rely on another package's best-effort layer to keep a token-bearing
         * URL out of an error report, so the URL is withheld here — do not
         * "improve" this by putting it back. The status code is kept: it is
         * diagnostic, not sensitive.
         */
        throw new Error(`httpSource: request failed with status ${response.status}`)
      }
      return (await response.json()) as FlagValues
    },
  }
}
