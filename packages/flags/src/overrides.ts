/**
 * `localStorage` key under which local flag overrides are stored, as a JSON
 * object mapping flag key to boolean. Exported as a constant so tests (and
 * any debugging tooling) never hardcode the string — a test that repeats the
 * literal would keep passing if the key were renamed underneath it.
 */
export const OVERRIDES_STORAGE_KEY = 'sentra:flags:overrides'

/** Query-string parameters that set an override are named `ff_<key>`. */
const QUERY_PREFIX = 'ff_'

function readQueryOverrides(): Record<string, boolean> {
  const overrides: Record<string, boolean> = {}
  const params = new URLSearchParams(window.location.search)
  for (const [rawKey, rawValue] of params) {
    if (!rawKey.startsWith(QUERY_PREFIX)) continue
    const key = rawKey.slice(QUERY_PREFIX.length)
    if (key.length === 0) continue
    overrides[key] = rawValue !== '0'
  }
  return overrides
}

function readStorageOverrides(): Record<string, boolean> {
  const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY)
  if (raw === null) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const overrides: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'boolean') overrides[key] = value
  }
  return overrides
}

/**
 * Reads locally-set flag overrides from the query string (`?ff_<key>=0|1`)
 * and `localStorage` (a JSON object at {@link OVERRIDES_STORAGE_KEY}), with
 * the query string taking precedence over `localStorage` when both set the
 * same key.
 *
 * Gated by `allowOverrides` and, when that is `false`, returns `{}` **before
 * reading either source** — not "read and ignore". Named risk area: access
 * control. Shipped enabled, any visitor who can edit their own URL or
 * `localStorage` could flip any flag on themselves, and a crafted link could
 * do it to anyone who opens it. The gate has to be the first line, not a
 * filter applied to the result, or a later edit that adds a new source could
 * reintroduce the leak without touching this check at all.
 */
export function readOverrides(allowOverrides: boolean): Record<string, boolean> {
  if (!allowOverrides) return {}
  return { ...readStorageOverrides(), ...readQueryOverrides() }
}
