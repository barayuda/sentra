import type { OpsResult } from '../errors.ts'
import type { FeatureFlag } from '../types.ts'
import type { OpsTransport } from '../transport.ts'
import { mapResult, required, requiredString, SchemaViolation } from './assert.ts'

/** Maps a wire flag. */
function toFlag(value: unknown, path: string): FeatureFlag {
  const record = required(value, path) as Record<string, unknown>
  if (typeof record.enabled !== 'boolean') {
    throw new SchemaViolation(`expected a boolean at ${path}.enabled`, `${path}.enabled`)
  }
  return {
    key: requiredString(record.key, `${path}.key`),
    label: requiredString(record.label, `${path}.label`),
    enabled: record.enabled,
    updatedAt: requiredString(record.updatedAt, `${path}.updatedAt`),
  }
}

/**
 * Fetches every feature flag.
 *
 * @param transport - See {@link OpsTransport}.
 */
export async function listFlags(
  transport: OpsTransport,
): Promise<OpsResult<readonly FeatureFlag[]>> {
  const response = await transport.request<unknown>('GET', '/flags')
  return mapResult(response, (wire) => {
    const record = required(wire, '$') as Record<string, unknown>
    const rawFlags = required(record.flags, '$.flags')
    if (!Array.isArray(rawFlags)) {
      throw new SchemaViolation('expected an array at $.flags', '$.flags')
    }
    return rawFlags.map((flag, index) => toFlag(flag, `$.flags[${index}]`))
  })
}

/** Input for {@link setFlag}. */
export interface SetFlagInput {
  /** Flag key. */
  readonly key: string
  /** Desired state. */
  readonly enabled: boolean
}

/**
 * Sets one flag's state.
 *
 * The key is percent-encoded before it reaches the path. A key is an
 * identifier the caller supplies, and an unescaped `../` in it would address
 * a different resource than the one named. Named risk area: input validation.
 *
 * @param transport - See {@link OpsTransport}.
 * @param input - See {@link SetFlagInput}.
 */
export async function setFlag(
  transport: OpsTransport,
  input: SetFlagInput,
): Promise<OpsResult<FeatureFlag>> {
  const response = await transport.request<unknown>(
    'PATCH',
    `/flags/${encodeURIComponent(input.key)}`,
    { enabled: input.enabled },
  )
  return mapResult(response, (wire) => toFlag(wire, '$'))
}
