import { inject, type InjectionKey, type Plugin } from 'vue'
import type { Session } from './session.ts'

/**
 * Every event that may cross a federation boundary, with its payload type.
 *
 * The map is closed on purpose. An open bus — `emit(name: string, data:
 * unknown)` — moves every mistake to runtime and makes the set of things
 * remotes may say to each other undiscoverable. Adding an event here is a
 * reviewed change to a shared contract, which is the correct weight for it.
 */
export interface ShellEventMap {
  /** A cart's line total changed. Consumed by the shell header's badge. */
  'cart:updated': { readonly totalQuantity: number }
  /**
   * Something asked for the cart overlay. Emitted by whichever header is
   * mounted — the shell's or the storefront's standalone one — and consumed
   * by the storefront's overlay, which owns the drawer.
   */
  'cart:open-requested': { readonly origin: string }
  /** The signed-in user changed, including to signed-out (`null`). */
  'session:changed': { readonly session: Session | null }
  /** A remote could not be registered or loaded. */
  'remote:failed': { readonly name: string; readonly reason: string }
}

/** A handler for one event. */
export type ShellEventHandler<K extends keyof ShellEventMap> = (payload: ShellEventMap[K]) => void

/** Publish/subscribe across remotes, typed by {@link ShellEventMap}. */
export interface ShellBus {
  /**
   * Publishes an event to every current subscriber, synchronously.
   *
   * @param event - Event name.
   * @param payload - Payload, whose type is fixed by the event name.
   */
  emit<K extends keyof ShellEventMap>(event: K, payload: ShellEventMap[K]): void
  /**
   * Subscribes to an event.
   *
   * Subscribing the same handler function twice is a no-op — subscribers are
   * held in a `Set`, so it is delivered once and a single `off()` removes it.
   * This differs from Node's `EventEmitter`, which would deliver twice.
   *
   * @param event - Event name.
   * @param handler - Called with each payload.
   * @returns A function that unsubscribes. Callers hold it rather than
   *   passing the handler back, so an inline arrow can still be removed.
   */
  on<K extends keyof ShellEventMap>(event: K, handler: ShellEventHandler<K>): () => void
}

/**
 * Creates a bus.
 *
 * Two properties are load-bearing rather than defensive:
 *
 * 1. **A throwing subscriber cannot stop delivery.** Subscribers are separate
 *    remotes. One remote's bug must not silently deprive every other remote
 *    of the event — that failure is nearly impossible to trace back.
 * 2. **The subscriber list is snapshotted before delivery.** A handler that
 *    subscribes or unsubscribes during `emit` would otherwise mutate the set
 *    being iterated, which either skips a handler or delivers to one that
 *    was not subscribed when the event was published.
 */
export function createShellBus(): ShellBus {
  const handlers = new Map<keyof ShellEventMap, Set<(payload: never) => void>>()

  function on<K extends keyof ShellEventMap>(event: K, handler: ShellEventHandler<K>): () => void {
    const existing = handlers.get(event) ?? new Set()
    existing.add(handler as (payload: never) => void)
    handlers.set(event, existing)
    return () => {
      existing.delete(handler as (payload: never) => void)
    }
  }

  function emit<K extends keyof ShellEventMap>(event: K, payload: ShellEventMap[K]): void {
    const subscribers = handlers.get(event)
    if (!subscribers) return
    for (const handler of [...subscribers]) {
      try {
        ;(handler as ShellEventHandler<K>)(payload)
      } catch (cause) {
        console.error(`[sentra] a "${event}" subscriber threw`, cause)
      }
    }
  }

  return { emit, on }
}

/**
 * A bus that accepts everything and delivers nothing.
 *
 * The `inject` default for call sites where a missing bus should degrade a
 * feature rather than break a page — see the cart store — and the instance
 * unit tests use when the bus is not what is under test.
 */
export const NULL_BUS: ShellBus = {
  emit() {
    /* deliberately empty */
  },
  on() {
    return () => {
      /* deliberately empty */
    }
  },
}

/**
 * Injection key for the bus.
 *
 * A namespaced **string**, not `Symbol()`, and that is the whole trick: a
 * `Symbol` created in the host is not equal to the one created in a
 * duplicated copy of this module inside a remote, so `inject` would silently
 * miss. A string key resolves by value and survives module duplication.
 * See ADR 0005.
 */
export const SHELL_BUS_INJECTION_KEY = 'sentra:shell-bus' as unknown as InjectionKey<ShellBus>

/** Installs a bus instance app-wide. */
export const shellBusPlugin: Plugin<[ShellBus]> = {
  install(app, bus) {
    app.provide(SHELL_BUS_INJECTION_KEY, bus)
  },
}

/**
 * Reads the installed bus from a component's setup.
 *
 * Throws when absent. A component that publishes events is broken without a
 * bus, and a silent no-op there produces a page where a button does nothing
 * and no error is ever reported.
 */
export function useShellBus(): ShellBus {
  const bus = inject(SHELL_BUS_INJECTION_KEY, null)
  if (!bus) {
    throw new Error(
      '[sentra] no shell bus available — install shellBusPlugin with createShellBus()',
    )
  }
  return bus
}
