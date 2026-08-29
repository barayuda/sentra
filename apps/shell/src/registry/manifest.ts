import { err, type Result } from '@sentra/result'
import {
  manifestError,
  parseRemoteManifest,
  type ManifestError,
  type ParsedManifest,
} from '@sentra/shell-contract'

/**
 * Fetches and validates the remote manifest.
 *
 * Every failure mode — unreachable, wrong status, unparseable, malformed —
 * becomes a `ManifestError`, because the caller's response to all of them is
 * the same: boot the shell with no remotes and say so on screen. A throw here
 * would instead leave a blank page, which is the one outcome a shell must
 * never produce.
 *
 * @param url - Manifest URL, same-origin.
 * @param fetchImpl - Injected so tests never reach the network.
 */
export async function fetchRemoteManifest(
  url: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Result<ParsedManifest, ManifestError>> {
  let response: Response
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' } })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'unknown fetch failure'
    return err(manifestError(`could not fetch ${url}: ${message}`))
  }
  if (!response.ok) {
    return err(manifestError(`manifest request failed with status ${response.status}`))
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return err(manifestError('manifest body was not valid JSON'))
  }
  return parseRemoteManifest(body)
}
