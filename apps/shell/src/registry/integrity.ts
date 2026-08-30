import type { RemoteManifestEntry } from '@sentra/shell-contract'

/** An entry that failed verification, and why. */
export interface RejectedRemote {
  readonly entry: RemoteManifestEntry
  readonly reason: string
}

/** The outcome of verifying a manifest's entries. */
export interface VerificationOutcome {
  readonly verified: readonly RemoteManifestEntry[]
  readonly rejected: readonly RejectedRemote[]
}

/**
 * Encodes bytes as base64 in a browser context.
 *
 * @param buffer - Digest bytes.
 */
function toBase64(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Verifies each remote's bytes against its published digest before it is registered.
 *
 * Why this exists in addition to the manifest's protocol allow-list: the
 * allow-list constrains *where* code comes from, not *what* code arrives. A
 * compromised remote host serves a valid `https:` URL from an allowed origin
 * and the allow-list has nothing to say about it.
 *
 * Known limitation, stated rather than hidden: this is a time-of-check /
 * time-of-use control. The federation loader fetches the entry again when it
 * runs, and a hostile server could serve different bytes the second time.
 * Browser-native Subresource Integrity does not have that gap; this design is
 * used only where the loader cannot be given an `integrity` attribute. See
 * ADR 0008.
 *
 * A missing digest fails closed in a production build and warns in development.
 * The asymmetry is deliberate. The dev loop reads a committed manifest that has
 * never been hashed — `hash-remotes.mjs` stamps digests after a build — so
 * requiring one unconditionally would break `pnpm dev` outright. A shipped
 * build has no such excuse: there, an entry without a digest is a remote nobody
 * can vouch for, and loading it anyway would mean the control is defeated by
 * forgetting, which is how controls are usually defeated. A platform-only tree
 * is unaffected either way, because the strip prunes the manifest to `[]` —
 * it has no entries to verify rather than unverifiable ones.
 *
 * Named risk area: supply chain.
 *
 * @param entries - Parsed manifest entries.
 * @param fetchImpl - Injected so tests never reach the network.
 * @param requireIntegrity - Whether a missing digest is fatal. Passed explicitly
 *   by tests so they never depend on ambient build mode.
 */
export async function verifyEntries(
  entries: readonly RemoteManifestEntry[],
  fetchImpl: typeof fetch = globalThis.fetch,
  requireIntegrity: boolean = import.meta.env.PROD,
): Promise<VerificationOutcome> {
  const verified: RemoteManifestEntry[] = []
  const rejected: RejectedRemote[] = []

  /* `crypto.subtle` exists only in a secure context. Served over plain HTTP from
     anything other than localhost it is `undefined`, and the digest call below
     would throw straight out of this function — rejecting the promise
     `bootShell` awaits and taking down the entire shell, not one remote, with a
     TypeError that names nothing an operator can act on. Failing closed here
     with the actual cause keeps the outcome the same and the diagnosis
     possible. A platform-only tree never reaches this: it has no entries. */
  if (entries.length > 0 && globalThis.crypto?.subtle === undefined) {
    return {
      verified: [],
      rejected: entries.map((entry) => ({
        entry,
        reason:
          'SubtleCrypto is unavailable, so integrity cannot be verified: this requires a secure context (https, or localhost). Serve the shell over https.',
      })),
    }
  }

  for (const entry of entries) {
    if (entry.integrity === undefined) {
      if (requireIntegrity) {
        rejected.push({
          entry,
          reason: 'no integrity digest published; refusing to register an unverified remote',
        })
        continue
      }
      console.warn(
        `[sentra] remote "${entry.name}" has no integrity digest — allowed in development only`,
      )
      verified.push(entry)
      continue
    }
    let bytes: ArrayBuffer
    try {
      const response = await fetchImpl(entry.entry, { cache: 'no-store' })
      if (!response.ok) {
        rejected.push({ entry, reason: `integrity fetch failed with status ${response.status}` })
        continue
      }
      bytes = await response.arrayBuffer()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'unknown fetch failure'
      rejected.push({ entry, reason: `integrity fetch failed: ${message}` })
      continue
    }
    const actual = `sha384-${toBase64(await crypto.subtle.digest('SHA-384', bytes))}`
    if (actual !== entry.integrity) {
      rejected.push({
        entry,
        reason: `integrity mismatch: expected ${entry.integrity}, got ${actual}`,
      })
      continue
    }
    verified.push(entry)
  }

  return { verified, rejected }
}
