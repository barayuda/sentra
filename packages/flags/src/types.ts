import type { Ref } from 'vue'

/** A flag's static declaration: what it is when nothing else says otherwise. */
export interface FlagDeclaration {
  readonly default: boolean
  /** Optional local rollout percentage, 0–100, used when the source omits the key. */
  readonly rollout?: number
}

export type FlagDeclarations = Readonly<Record<string, FlagDeclaration>>

/** `boolean` is absolute; a number 0–100 is a rollout percentage bucketed locally. */
export type FlagValues = Readonly<Record<string, boolean | number>>

/**
 * Targeting input.
 *
 * Carries no identity fields. A flag service is a third party receiving an
 * attribute on every evaluation, so the default must be that it receives nothing
 * identifying. `stableId` is supplied by the application and must be opaque.
 */
export interface FlagContext {
  readonly stableId?: string
  readonly attributes?: Readonly<Record<string, string | number | boolean>>
}

/** The seam. */
export interface FlagSource {
  load(context: FlagContext): Promise<FlagValues>
}

/** Options for `createFlagClient`. */
export interface CreateFlagClientOptions<D extends FlagDeclarations> {
  readonly declarations: D
  readonly source: FlagSource
  readonly context?: FlagContext
  /** Attribute keys permitted to reach the source. Everything else is dropped. */
  readonly allowedAttributeKeys?: readonly string[]
  /** Default `false`. Must never be true in production. */
  readonly allowOverrides?: boolean
  readonly onError?: (error: unknown) => void
}

/** What an application holds and what `'sentra:flags'` provides. */
export interface FlagClient<K extends string> {
  isOn(key: K): boolean
  refresh(): Promise<void>
  readonly ready: Ref<boolean>
}
