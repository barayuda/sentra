import type {
  Cart,
  CartLine,
  MoneyV2,
  StorefrontError,
  StorefrontResult,
} from '@sentra/sdk-commerce'
import { NULL_BUS, SHELL_BUS_INJECTION_KEY } from '@sentra/shell-contract'
import { defineStore } from 'pinia'
import { computed, inject, ref, shallowRef } from 'vue'
import { getStorefrontClient } from '../storefront.ts'

/** Where the cart id is persisted between visits. */
export const CART_ID_STORAGE_KEY = 'sentra:cart-id'

/**
 * Reads the persisted cart id.
 *
 * Wrapped in try/catch because `localStorage` throws rather than returning null
 * in Safari private mode and under some privacy extensions. A cart that cannot
 * be remembered is a degraded experience; a cart that throws on load is a
 * blank page.
 */
function readStoredCartId(): string | null {
  try {
    return localStorage.getItem(CART_ID_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Persists or clears the cart id, ignoring storage failures. */
function writeStoredCartId(cartId: string | null): void {
  try {
    if (cartId === null) localStorage.removeItem(CART_ID_STORAGE_KEY)
    else localStorage.setItem(CART_ID_STORAGE_KEY, cartId)
  } catch {
    /* Storage unavailable — the cart still works for this session. */
  }
}

/**
 * Cart state for the storefront.
 *
 * Scoped to this application rather than living in `@sentra/sdk-commerce`
 * (spec §6.2): a cart is one application's session state, and putting it in the
 * SDK would force every consumer — including a later console app with no cart
 * — to carry it.
 *
 * The store owns the cart id lifecycle: created on the first add, persisted for
 * return visits, and forgotten when Shopify says it no longer exists.
 */
export const useCartStore = defineStore('cart', () => {
  const cart = shallowRef<Cart | null>(null)
  const error = shallowRef<StorefrontError | null>(null)
  /** Count, not a flag — see the concurrency test. */
  const pending = ref(0)

  /**
   * The shell's bus, or a no-op when the store is constructed outside an app
   * — which the store's own unit tests do, and which `useShellBus()` would
   * throw on. The asymmetry with components is deliberate: at this call site
   * the bus is telemetry, so a missed emit degrades the shell header's badge
   * while the cart itself keeps working. A component whose button publishes an
   * event is broken without a bus, so `useShellBus()` still throws there.
   *
   * The trailing `?? NULL_BUS` matters: Vue's `inject()` only honours its
   * default value when called under a component instance or an
   * `app.runWithContext` — with neither (a bare `useCartStore()` after only
   * `setActivePinia(createPinia())`, as this store's own tests do), it
   * returns `undefined` outright. Pinia only threads `runWithContext` through
   * a setup store when the pinia instance has been installed on an app
   * (`app.use(pinia)`, which sets `pinia._a`); a pinia that was merely
   * activated has no app to run with, so `inject`'s own default is
   * unreachable and this fallback is what actually makes the store usable
   * outside an app.
   */
  const bus = inject(SHELL_BUS_INJECTION_KEY, NULL_BUS) ?? NULL_BUS

  /** Publishes the current line total so any host header can badge it. */
  function publishCount(): void {
    bus.emit('cart:updated', { totalQuantity: itemCount.value })
  }

  /**
   * Invalidates a superseded mutation's write. Two overlapping calls resolve
   * in network order, not call order — without this, a `restore()` that
   * started first but resolves last could overwrite state a later `addLine()`
   * already wrote, silently discarding the user's action. The same technique
   * `useCollection` (`@sentra/sdk-commerce/vue`) uses for the identical shape.
   */
  let generation = 0

  const loading = computed(() => pending.value > 0)
  const itemCount = computed(() => cart.value?.totalQuantity ?? 0)
  const lines = computed<readonly CartLine[]>(() => cart.value?.lines ?? [])
  const subtotal = computed<MoneyV2 | null>(() => cart.value?.subtotal ?? null)
  const checkoutUrl = computed<string | null>(() => cart.value?.checkoutUrl ?? null)
  const isEmpty = computed(() => lines.value.length === 0)

  /**
   * Runs one client call, tracking pending state and recording failures.
   *
   * Only safe for calls whose success value is never itself meaningfully
   * `null` — {@link restore} does not use this because `getCart` returns
   * `Cart | null` on success, and collapsing "call failed" and "call
   * succeeded with null" into the same `null` here would lose the
   * failure-vs-expiry distinction that action needs.
   *
   * @param operation - The call to run.
   * @returns The value on success, or null on failure.
   */
  async function run<T>(operation: () => Promise<StorefrontResult<T>>): Promise<T | null> {
    const current = (generation += 1)
    pending.value += 1
    try {
      const result = await operation()
      if (current !== generation) return null
      if (!result.ok) {
        error.value = result.error
        return null
      }
      error.value = null
      return result.value
    } finally {
      pending.value -= 1
    }
  }

  /** Adopts a cart returned by the API and persists its id. */
  function adopt(next: Cart): void {
    cart.value = next
    writeStoredCartId(next.id)
  }

  /**
   * Loads the cart persisted from a previous visit, if any.
   *
   * Deliberately does NOT go through {@link run}. `getCart` resolves to
   * `Cart | null`, and `run` collapses "the request failed" and "the cart does
   * not exist" into the same `null` — two cases that must be handled in
   * opposite ways. A `null` cart means Shopify no longer has it (carts expire),
   * so the stored id is dropped; a transport failure is no evidence the cart is
   * gone, so the id survives for the next attempt. Any future action returning
   * a nullable `T` needs the same treatment.
   */
  async function restore(): Promise<void> {
    const cartId = readStoredCartId()
    if (!cartId) return
    const current = (generation += 1)
    pending.value += 1
    try {
      const result = await getStorefrontClient().getCart({ cartId })
      if (current !== generation) return
      if (!result.ok) {
        error.value = result.error
        return
      }
      error.value = null
      if (result.value === null) {
        writeStoredCartId(null)
        cart.value = null
        publishCount()
        return
      }
      adopt(result.value)
      publishCount()
    } finally {
      pending.value -= 1
    }
  }

  /**
   * Adds a variant to the cart, creating the cart if needed.
   *
   * Creating with the line included is one round trip rather than two, which
   * matters on the first add — the interaction most likely to be measured.
   *
   * @param merchandiseId - Variant id.
   * @param quantity - How many; defaults to one.
   * @returns Whether the cart now reflects the addition.
   */
  async function addLine(merchandiseId: string, quantity = 1): Promise<boolean> {
    const client = getStorefrontClient()
    const existing = cart.value
    const next = existing
      ? await run(() =>
          client.addCartLines({ cartId: existing.id, lines: [{ merchandiseId, quantity }] }),
        )
      : await run(() => client.createCart({ lines: [{ merchandiseId, quantity }] }))
    if (!next) return false
    adopt(next)
    publishCount()
    return true
  }

  /**
   * Sets a line's quantity, removing the line at zero.
   *
   * Routing zero through removal keeps one meaning per call: the caller's
   * analytics event is unambiguously `remove_from_cart` rather than an update
   * that happens to empty a line.
   *
   * @param lineId - Cart line id.
   * @param quantity - New quantity; zero removes.
   */
  async function setLineQuantity(lineId: string, quantity: number): Promise<boolean> {
    if (quantity <= 0) return removeLine(lineId)
    const existing = cart.value
    if (!existing) return false
    const next = await run(() =>
      getStorefrontClient().updateCartLines({
        cartId: existing.id,
        lines: [{ id: lineId, quantity }],
      }),
    )
    if (!next) return false
    adopt(next)
    publishCount()
    return true
  }

  /**
   * Removes a line.
   *
   * @param lineId - Cart line id.
   */
  async function removeLine(lineId: string): Promise<boolean> {
    const existing = cart.value
    if (!existing) return false
    const next = await run(() =>
      getStorefrontClient().removeCartLines({ cartId: existing.id, lineIds: [lineId] }),
    )
    if (!next) return false
    adopt(next)
    publishCount()
    return true
  }

  /** Drops local cart state and the persisted id. */
  function forget(): void {
    cart.value = null
    error.value = null
    writeStoredCartId(null)
    publishCount()
  }

  return {
    cart,
    error,
    loading,
    itemCount,
    lines,
    subtotal,
    checkoutUrl,
    isEmpty,
    restore,
    addLine,
    setLineQuantity,
    removeLine,
    forget,
  }
})
