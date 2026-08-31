import { ref, shallowRef } from 'vue'
import { bucket } from './bucket.ts'
import { readOverrides } from './overrides.ts'
import type {
  CreateFlagClientOptions,
  FlagClient,
  FlagContext,
  FlagDeclaration,
  FlagDeclarations,
  FlagValues,
} from './types.ts'

/**
 * Builds the context object forwarded to `source.load`, filtering
 * `attributes` down to `allowedAttributeKeys`.
 *
 * Allowlisting rather than blocklisting: with no keys named, no attributes
 * are forwarded at all. `attributes` reaches a third party on every
 * evaluation, so the safe default is "nothing crosses the seam" rather than
 * "everything except what a maintainer remembered to exclude" — access
 * control.
 */
function buildSourceContext(
  context: FlagContext | undefined,
  allowedAttributeKeys: readonly string[] | undefined,
): FlagContext {
  const sourceContext: {
    stableId?: string
    attributes?: Record<string, string | number | boolean>
  } = {}

  if (context?.stableId !== undefined) sourceContext.stableId = context.stableId

  if (context?.attributes !== undefined && allowedAttributeKeys !== undefined) {
    const attributes = context.attributes
    const filtered: Record<string, string | number | boolean> = {}
    for (const key of allowedAttributeKeys) {
      const value = attributes[key]
      if (value !== undefined) filtered[key] = value
    }
    if (Object.keys(filtered).length > 0) sourceContext.attributes = filtered
  }

  return sourceContext
}

/**
 * Resolves one flag's boolean value.
 *
 * Order: override → snapshot value from the source → declared local
 * rollout → declared default. A numeric value — whether the source's
 * snapshot or the declaration's own `rollout` — needs a `stableId` to
 * bucket against; without one, resolution falls through to the next step
 * rather than bucketing an anonymous caller, since an anonymous bucket
 * would just be a random coin flip repeated on every read.
 */
function resolveFlag(
  key: string,
  declaration: FlagDeclaration,
  snapshotValue: boolean | number | undefined,
  stableId: string | undefined,
  overrideValue: boolean | undefined,
): boolean {
  if (overrideValue !== undefined) return overrideValue

  if (snapshotValue !== undefined) {
    if (typeof snapshotValue === 'boolean') return snapshotValue
    if (stableId !== undefined) return bucket(stableId, key) < snapshotValue
  }

  if (declaration.rollout !== undefined && stableId !== undefined) {
    return bucket(stableId, key) < declaration.rollout
  }

  return declaration.default
}

/**
 * Builds a flag client.
 *
 * `refresh()` is async; `isOn()` is sync. That split is the reason declared
 * defaults exist at all: a component renders before any network round trip
 * can finish, and `isOn()` must return something on that very first render.
 * Declared defaults are what make the backend optional — a consumer with no
 * `source` wired up, or one whose source never resolves, still gets
 * sensible, static behaviour instead of an error or a suspended render.
 *
 * `refresh()` never throws: a rejected `source.load` is reported through
 * `onError` (when given) and the last good snapshot — the declared defaults
 * on the very first call — is kept rather than discarded.
 */
export function createFlagClient<D extends FlagDeclarations>(
  options: CreateFlagClientOptions<D>,
): FlagClient<Extract<keyof D, string>> {
  const allowOverrides = options.allowOverrides ?? false
  const overrides = readOverrides(allowOverrides)
  const snapshot = shallowRef<FlagValues>({})
  const ready = ref(false)

  function isOn(key: Extract<keyof D, string>): boolean {
    const declaration: FlagDeclaration = options.declarations[key] ?? { default: false }
    return resolveFlag(
      key,
      declaration,
      snapshot.value[key],
      options.context?.stableId,
      overrides[key],
    )
  }

  async function refresh(): Promise<void> {
    try {
      const sourceContext = buildSourceContext(options.context, options.allowedAttributeKeys)
      const values = await options.source.load(sourceContext)
      snapshot.value = values
      ready.value = true
    } catch (error) {
      options.onError?.(error)
    }
  }

  return { isOn, refresh, ready }
}
