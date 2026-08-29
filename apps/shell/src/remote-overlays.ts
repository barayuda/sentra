import type { Component, InjectionKey } from 'vue'

/**
 * Injection key for the overlays contributed by registered remotes.
 *
 * A namespaced string, not `Symbol()` — see `SHELL_BUS_INJECTION_KEY` in
 * `@sentra/shell-contract` for why that matters across a federation
 * boundary. Task 11 provides the real array, one `RemoteModule.overlay` per
 * registered remote, at register time. With nothing registered — which is
 * every state this task tests — `App.vue` injects an empty array by default
 * and renders nothing.
 */
export const REMOTE_OVERLAYS_INJECTION_KEY = 'sentra:remote-overlays' as unknown as InjectionKey<
  readonly Component[]
>
