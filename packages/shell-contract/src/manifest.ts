import { err, ok, type Result } from '@sentra/result'

/** One remote, as published in the runtime registry. */
export interface RemoteManifestEntry {
  /** Federation container name. Must match the remote's `federation({ name })`. */
  readonly name: string
  /** Absolute `http:`/`https:` URL of the remote's entry script. */
  readonly entry: string
  /** URL prefix this remote's routes are mounted under, e.g. `/ops`. */
  readonly basePath: string
}

/** An entry that was dropped, and why. */
export interface RejectedEntry {
  /** Position in the source document, so an operator can find it. */
  readonly index: number
  /** Human-readable cause. Surfaced in the console and in `remote:failed`. */
  readonly reason: string
}

/** The outcome of parsing a manifest document. */
export interface ParsedManifest {
  /** Entries that passed every check, in document order. */
  readonly entries: readonly RemoteManifestEntry[]
  /** Entries that did not. */
  readonly rejected: readonly RejectedEntry[]
}

/** The manifest document itself was unusable. */
export type ManifestError = { readonly kind: 'shape'; readonly message: string }

/**
 * Builds a {@link ManifestError}.
 *
 * Exported because the shell raises the same error for transport failures the
 * parser never sees — an unreachable URL, a 404, a body that is not JSON. One
 * builder keeps every one of those failures the same shape at the call site
 * that has to render them.
 *
 * @param message - What was wrong, in terms the console can print.
 */
export function manifestError(message: string): ManifestError {
  return { kind: 'shape', message }
}

/**
 * Whether a value is a non-empty string after trimming.
 *
 * @param value - Candidate.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * Validates an entry URL.
 *
 * The protocol allow-list is the security control, not a formality. This URL
 * is about to become the `src` of a script tag, so `javascript:` and `data:`
 * would turn a writable manifest into arbitrary code execution in the shell's
 * origin. Named risk area: supply chain.
 *
 * @param value - Candidate URL.
 * @returns The reason it is unusable, or null when it is fine.
 */
function entryUrlProblem(value: unknown): string | null {
  if (!isNonEmptyString(value)) return 'entry must be a non-empty string'
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return `entry must be an absolute URL, got "${value}"`
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `entry protocol must be http: or https:, got "${url.protocol}"`
  }
  return null
}

/**
 * Validates a base path.
 *
 * @param value - Candidate path.
 * @returns The reason it is unusable, or null when it is fine.
 */
function basePathProblem(value: unknown): string | null {
  if (!isNonEmptyString(value)) return 'basePath must be a non-empty string'
  if (!value.startsWith('/')) return `basePath must start with "/", got "${value}"`
  if (value === '/') {
    /* A remote owning the whole URL space would shadow every other remote and
       the shell's own routes, and which one won would depend on load order. */
    return 'basePath must not be "/" — a remote cannot own the entire URL space'
  }
  if (value.endsWith('/')) return `basePath must not end with "/", got "${value}"`
  if (value.includes('*')) return `basePath must not contain a wildcard, got "${value}"`
  return null
}

/**
 * Parses and validates a remote registry document.
 *
 * Two failure levels, deliberately. A document that is not an array is a
 * deployment mistake — usually an HTML error page served where JSON was
 * expected — and there is nothing to salvage, so it is a hard error. A single
 * malformed entry is different: dropping it and booting the rest keeps the
 * platform up, which is the whole reason the registry is separate from the
 * build. Every drop is recorded so it is visible rather than silent.
 *
 * @param input - Parsed JSON, of unknown shape.
 */
export function parseRemoteManifest(input: unknown): Result<ParsedManifest, ManifestError> {
  if (!Array.isArray(input)) {
    return err({ kind: 'shape', message: 'remote manifest must be a JSON array' })
  }

  const entries: RemoteManifestEntry[] = []
  const rejected: RejectedEntry[] = []
  const seenNames = new Set<string>()
  const seenBasePaths = new Set<string>()

  input.forEach((candidate: unknown, index: number) => {
    function reject(reason: string): void {
      rejected.push({ index, reason })
    }

    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      reject('entry must be an object')
      return
    }
    const record = candidate as Record<string, unknown>

    if (!isNonEmptyString(record.name)) {
      reject('name must be a non-empty string')
      return
    }
    const entryProblem = entryUrlProblem(record.entry)
    if (entryProblem !== null) {
      reject(entryProblem)
      return
    }
    const pathProblem = basePathProblem(record.basePath)
    if (pathProblem !== null) {
      reject(pathProblem)
      return
    }

    const name = record.name.trim()
    const basePath = record.basePath as string
    if (seenNames.has(name)) {
      reject(`duplicate name "${name}" — the earlier entry wins`)
      return
    }
    if (seenBasePaths.has(basePath)) {
      reject(`duplicate basePath "${basePath}" — the earlier entry wins`)
      return
    }

    seenNames.add(name)
    seenBasePaths.add(basePath)
    entries.push({ name, entry: record.entry as string, basePath })
  })

  return ok({ entries, rejected })
}
