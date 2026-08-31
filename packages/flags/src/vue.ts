import { inject, ref, type InjectionKey, type Plugin } from 'vue'
import type { FlagClient } from './types.ts'

/** String-keyed so tests can provide a client without importing this instance. */
export const FLAGS_INJECTION_KEY = 'sentra:flags' as unknown as InjectionKey<FlagClient<string>>

/**
 * The null object used as the `inject` default.
 *
 * `isOn` returns `false` rather than "the declared default" because a null
 * client holds no declarations — there is no default for it to read.
 *
 * `ready: ref(true)` is deliberate, not "the safe-looking value" — a null
 * client has no source, so there is nothing outstanding to wait for; it is
 * ready the moment it exists, matching `FlagClient.ready`'s contract in
 * `./types.ts` ("at least one load attempt has completed"): a client with no
 * attempt to complete is trivially settled. Combined with `isOn() => false`,
 * this degrades fail-closed: a consumer guarding on `v-if="ready"` renders
 * immediately, with every flag reading off, rather than being stranded
 * forever behind a `ref(false)` that never flips.
 */
export const NULL_FLAGS: FlagClient<string> = {
  isOn() {
    return false
  },
  async refresh() {
    /* deliberately empty */
  },
  ready: ref(true),
}

/** Vue plugin: `app.use(flagsPlugin, client)` provides an existing client. */
export const flagsPlugin: Plugin<[FlagClient<string>]> = {
  install(app, client) {
    app.provide(FLAGS_INJECTION_KEY, client)
  },
}

/**
 * Returns the app's flag client, or {@link NULL_FLAGS} when none is
 * installed.
 *
 * `K` is supplied by the caller and the body below is a cast — nothing here
 * checks that the installed client actually declares those keys. This gives
 * a call site convenient typing, not a verified one; the compile-time
 * guarantee that an undeclared key is rejected belongs to `createFlagClient`
 * alone, whose key union is inferred from the `declarations` object passed
 * to it.
 */
export function useFlags<K extends string = string>(): FlagClient<K> {
  return inject(FLAGS_INJECTION_KEY, NULL_FLAGS) as FlagClient<K>
}
