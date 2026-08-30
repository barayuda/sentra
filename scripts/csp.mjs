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
    /* Checked here too, not only in `validateExtraSources`: without this, the
       strip accepts and re-emits a non-widenable directive (e.g. `script-src`)
       and reports success, and the eventual rejection surfaces later, from
       `validateExtraSources` at build time, naming the wrong stage as the one
       that caught it. */
    if (!WIDENABLE.has(directive)) {
      throw new Error(
        `csp-sources.json may not widen ${directive}; widenable directives are ${[...WIDENABLE].join(', ')}`,
      )
    }
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
 * Directives that a browser silently ignores when a policy is delivered via a
 * `<meta http-equiv="Content-Security-Policy">` element rather than the
 * `Content-Security-Policy` HTTP response header. Each is on this set for its
 * own documented reason, not by inference from the others:
 *
 * - `frame-ancestors` — the CSP specification scopes it to the HTTP header
 *   delivery form only; Chrome's own console diagnostic states this plainly
 *   ("The Content Security Policy directive 'frame-ancestors' is ignored when
 *   delivered via a `<meta>` element"), logged on every load of a document
 *   that carries it in meta form.
 * - `report-uri` — meaningless without a network request the meta form has no
 *   mechanism to trigger; documented behaviour, same as `frame-ancestors`.
 * - `report-to` — the modern replacement for `report-uri`; ignored in meta
 *   form for the identical reason.
 *
 * Defined explicitly, and filtered against by name, so that adding
 * `report-uri` or `report-to` to `buildCspPolicy`'s `directives` object in the
 * future cannot silently reintroduce a meta-tag console error the way
 * `frame-ancestors` did here.
 */
const META_IGNORED_DIRECTIVES = new Set(['frame-ancestors', 'report-uri', 'report-to'])

/**
 * Builds the ordered `[name, sources]` pairs common to both delivery forms of
 * the shell's Content-Security-Policy.
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
 * @returns {Array<[string, string[]]>} Directive name/sources pairs, in emit order.
 * @throws {Error} When `extra` would weaken the policy.
 */
function buildDirectives(entries, extra) {
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

  return Object.entries(directives).map(([name, sources]) => [
    name,
    [...sources, ...(extra[name] ?? [])],
  ])
}

/**
 * Builds the shell's Content-Security-Policy in its **header** form.
 *
 * This is the full policy, `frame-ancestors 'none'` included, meant for the
 * `Content-Security-Policy` HTTP response header — the only delivery form
 * that actually enforces `frame-ancestors`, `report-uri`, and `report-to`.
 * `scripts/generate-csp.mjs` writes this string, unchanged, to
 * `apps/shell/dist/csp-headers.txt`.
 *
 * @param {Array<{entry: string}>} entries - Manifest entries.
 * @param {Record<string, string[]>} extra - Extra sources per directive.
 * @returns {string} A policy string suitable for the CSP header.
 * @throws {Error} When `extra` would weaken the policy.
 */
export function buildCspPolicy(entries, extra) {
  return buildDirectives(entries, extra)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}

/**
 * Builds the shell's Content-Security-Policy in its **meta** form.
 *
 * Identical to {@link buildCspPolicy} except that every directive in
 * {@link META_IGNORED_DIRECTIVES} is omitted. Emitting those directives in a
 * `<meta http-equiv="Content-Security-Policy">` tag buys zero protection —
 * the browser ignores them there — and costs a console error on every page
 * load. `scripts/generate-csp.mjs` injects this string into
 * `apps/shell/dist/index.html`.
 *
 * @param {Array<{entry: string}>} entries - Manifest entries.
 * @param {Record<string, string[]>} extra - Extra sources per directive.
 * @returns {string} A policy string suitable for the meta tag.
 * @throws {Error} When `extra` would weaken the policy.
 */
export function buildCspPolicyForMeta(entries, extra) {
  return buildDirectives(entries, extra)
    .filter(([name]) => !META_IGNORED_DIRECTIVES.has(name))
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}
