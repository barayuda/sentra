/**
 * The `Result` convention now lives in `@sentra/result` so that SDKs with
 * unrelated transports can share it. This module stays as the SDK's internal
 * import path: every operation file already imports `./result.ts`, and the
 * package's public export at `src/index.ts` is unchanged, so the extraction
 * is invisible to consumers.
 */
export { err, isErr, isOk, ok, type Result } from '@sentra/result'
