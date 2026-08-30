/** Directives an entry in `security/csp-sources.json` is allowed to widen. */
const WIDENABLE = new Set(['connect-src', 'img-src', 'font-src', 'media-src'])

/**
 * Rejects an extra-sources map that would weaken the policy.
 *
 * A committed allow-list is only as good as what it refuses to accept. The
 * three refusals here each close a way a well-meaning edit could turn the
 * policy into decoration: widening `script-src` (which would let this file
 * authorise code execution, the one thing it must never do), a wildcard host
 * (which allows an attacker-controlled subdomain), and a scheme- or
 * path-bearing source (which CSP reinterprets in ways the author rarely
 * intends — `https:` allows every host on the scheme, and a path is honoured
 * as a prefix match only for some directives). Named risk area: content
 * injection.
 *
 * @param {Record<string, string[]>} extra - Directive name to extra sources.
 * @returns {void}
 * @throws {Error} When any entry would weaken the policy.
 */
export function validateExtraSources(extra) {
  for (const [directive, sources] of Object.entries(extra)) {
    if (!WIDENABLE.has(directive)) {
      throw new Error(
        `csp-sources.json may not widen ${directive}; widenable directives are ${[...WIDENABLE].join(', ')}`,
      )
    }
    for (const source of sources) {
      if (source.includes('*')) {
        throw new Error(`csp-sources.json: wildcard source ${source} in ${directive}`)
      }
      let url
      try {
        url = new URL(source)
      } catch {
        throw new Error(`csp-sources.json: ${source} in ${directive} is not an absolute origin`)
      }
      if (source !== url.origin) {
        throw new Error(
          `csp-sources.json: ${source} in ${directive} must be a bare origin, got path or trailing content`,
        )
      }
      const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
      if (url.protocol !== 'https:' && !loopback) {
        throw new Error(`csp-sources.json: ${source} in ${directive} must use https`)
      }
    }
  }
}

/** Owners an entry in `security/csp-sources.json` may declare. */
const OWNERS = new Set(['platform', 'reference'])

/**
 * Requires every source entry to declare who owns it, and why it exists.
 *
 * This file outlives the reference half: `security/` is not deleted by
 * `scripts/strip-reference.mjs`, so an entry added for `apps/storefront`
 * survives that app's deletion and keeps widening the policy on behalf of code
 * that is gone. The owner field is what lets the strip prune it.
 *
 * The validation matters more than the field. A missing or unrecognised owner
 * must fail rather than default, because every sensible default is wrong in one
 * direction: default to `platform` and reference origins survive the strip
 * silently, which is the over-permissive outcome this exists to prevent;
 * default to `reference` and a genuine platform origin disappears from an
 * adopter's policy, breaking their app for a reason no error message explains.
 *
 * Named risk area: content injection.
 *
 * @param {Record<string, unknown>} file - Parsed `csp-sources.json`.
 * @returns {void}
 * @throws {Error} When an entry lacks a valid owner or a non-empty reason.
 */
export function validateSourceOwners(file) {
  for (const [directive, origins] of Object.entries(file)) {
    if (directive.startsWith('$')) continue
    for (const [origin, record] of Object.entries(origins ?? {})) {
      if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error(
          `csp-sources.json: ${origin} in ${directive} must be an object with owner and reason`,
        )
      }
      if (!OWNERS.has(record.owner)) {
        throw new Error(
          `csp-sources.json: ${origin} in ${directive} declares owner "${record.owner}" — must be one of ${[...OWNERS].join(', ')}`,
        )
      }
      if (typeof record.reason !== 'string' || record.reason.trim() === '') {
        throw new Error(`csp-sources.json: ${origin} in ${directive} has an empty reason`)
      }
    }
  }
}

/**
 * Extracts the distinct origins a manifest's remotes are served from.
 *
 * @param {Array<{entry: string}>} entries - Manifest entries.
 * @returns {string[]} Distinct origins, in first-seen order.
 */
export function remoteOrigins(entries) {
  const origins = []
  for (const entry of entries) {
    let url
    try {
      url = new URL(entry.entry)
    } catch {
      continue
    }
    if (!origins.includes(url.origin)) origins.push(url.origin)
  }
  return origins
}

/**
 * Builds the shell's Content-Security-Policy from its remote manifest.
 *
 * Remote origins are derived from `remotes.json` rather than maintained by
 * hand, and that is the core of the design: the manifest is the list of
 * origins the shell will execute code from, and a second hand-kept copy of
 * that list drifts. Named risk area: content injection.
 *
 * `extra` carries only what the manifest structurally cannot express — the
 * backend and CDN origins belonging to code inside the remotes, which the
 * shell has no way to discover. It is validated before use and may never
 * widen `script-src`.
 *
 * `style-src` names the remote origins because each remote's federated
 * stylesheet is fetched from its own origin; the Task 1 spike observed both
 * remotes failing to mount without this. It deliberately omits
 * `'unsafe-inline'`: Vite extracts single-file-component styles to static CSS
 * at build time, and Vue's `:style` bindings go through CSSOM, which CSP does
 * not govern. The spike confirmed zero violations without it.
 *
 * @param {Array<{entry: string}>} entries - Manifest entries.
 * @param {Record<string, string[]>} extra - Extra sources per directive.
 * @returns {string} A policy string suitable for a header or a meta tag.
 * @throws {Error} When `extra` would weaken the policy.
 */
export function buildCspPolicy(entries, extra) {
  validateExtraSources(extra)

  const origins = remoteOrigins(entries)
  const withRemotes = (sources) => [...sources, ...origins]

  const directives = {
    'default-src': ["'self'"],
    'script-src': withRemotes(["'self'"]),
    'connect-src': withRemotes(["'self'"]),
    'style-src': withRemotes(["'self'"]),
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'", 'data:'],
    'media-src': ["'self'"],
    'worker-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${[...sources, ...(extra[name] ?? [])].join(' ')}`)
    .join('; ')
}
