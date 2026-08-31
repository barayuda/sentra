/**
 * FNV-1a, 32-bit.
 *
 * Chosen for determinism and size, not for any security property. It is not
 * cryptographic and must not be used to conceal flag assignment from a user who
 * can read their own bucket.
 */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Assigns a stable bucket in `0..99` for one id and flag.
 *
 * Keying on both means a user in the first decile of one flag is not
 * automatically in the first decile of every other — otherwise every partial
 * rollout would hit the same unlucky cohort.
 */
export function bucket(stableId: string, key: string): number {
  return fnv1a(`${stableId}:${key}`) % 100
}
