import {
  computed,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
  type WatchSource,
} from 'vue'
import type { StorefrontError, StorefrontResult } from '../errors.ts'
import type { ProductDetail, ProductSummary } from '../types.ts'
import { useStorefront } from './plugin.ts'

/** Reactive state for one Storefront read. */
export interface StorefrontQuery<T> {
  /** Last successful value; null before the first success. */
  readonly data: ShallowRef<T | null>
  /** Last failure; null while the most recent load succeeded. */
  readonly error: ShallowRef<StorefrontError | null>
  /** True while a load is in flight. */
  readonly loading: Ref<boolean>
  /** Re-runs the loader. */
  refresh(): Promise<void>
}

/** Options for {@link useStorefrontQuery}. */
export interface StorefrontQueryOptions {
  /**
   * Load on creation.
   *
   * @defaultValue `true`
   */
  readonly immediate?: boolean
  /** Sources that, when changed, trigger a reload. */
  readonly watch?: WatchSource | WatchSource[]
}

/**
 * Wraps a Storefront call in reactive state.
 *
 * Two behaviours worth stating because they are choices, not accidents:
 *
 * 1. **Stale data survives a failed refresh.** A network blip should show an
 *    error banner over the catalogue the user was reading, not replace it with
 *    an empty page. `data` is only overwritten by a success.
 * 2. **Superseded responses are discarded.** Every call takes a token and
 *    checks it before writing; a slow first request that lands after a fast
 *    second one is dropped. Without this, typing in a search field makes the
 *    displayed results depend on network ordering.
 *
 * @param loader - Performs the call and returns a result.
 * @param options - See {@link StorefrontQueryOptions}.
 */
export function useStorefrontQuery<T>(
  loader: () => Promise<StorefrontResult<T>>,
  options: StorefrontQueryOptions = {},
): StorefrontQuery<T> {
  const { immediate = true, watch: sources } = options
  const data = shallowRef<T | null>(null)
  const error = shallowRef<StorefrontError | null>(null)
  const loading = ref(false)
  let token = 0

  async function refresh(): Promise<void> {
    const current = (token += 1)
    loading.value = true
    const result = await loader()
    if (current !== token) return
    loading.value = false
    if (result.ok) {
      data.value = result.value
      error.value = null
      return
    }
    error.value = result.error
  }

  if (sources) watch(sources, () => void refresh())
  if (immediate) void refresh()

  return { data, error, loading, refresh }
}

/**
 * Fetches a product by handle, reloading when the handle changes.
 *
 * `data` is `null` both before the first load and for a handle that does not
 * exist. Callers distinguish the two with `loading`.
 *
 * @param handle - Product handle; a ref or getter re-triggers the query.
 */
export function useProduct(
  handle: MaybeRefOrGetter<string>,
): StorefrontQuery<ProductDetail | null> {
  const client = useStorefront()
  return useStorefrontQuery(() => client.getProduct({ handle: toValue(handle) }), {
    watch: () => toValue(handle),
  })
}

/** A paginated collection feed. */
export interface CollectionFeed {
  /** Every product loaded so far, in order. */
  readonly products: ShallowRef<readonly ProductSummary[]>
  /** The collection's title, once known. */
  readonly title: ComputedRef<string>
  readonly error: ShallowRef<StorefrontError | null>
  readonly loading: Ref<boolean>
  /** Whether another page exists. */
  readonly hasNextPage: ComputedRef<boolean>
  /** Loads the next page and appends it. No-op when exhausted or already loading. */
  loadMore(): Promise<void>
  /** Discards loaded pages and reloads from the first. */
  reset(): Promise<void>
}

/** Options for {@link useCollection}. */
export interface UseCollectionOptions {
  /**
   * Products per request.
   *
   * @defaultValue `12`
   */
  readonly pageSize?: number
}

/**
 * Loads a collection page by page, accumulating products.
 *
 * The single in-flight guard is load-bearing rather than defensive: an infinite
 * scroller evaluates its trigger on every scroll frame, so an unguarded
 * `loadMore` would request the same cursor dozens of times and append the same
 * products repeatedly.
 *
 * @param handle - Collection handle; a ref or getter resets the feed on change.
 * @param options - See {@link UseCollectionOptions}.
 */
export function useCollection(
  handle: MaybeRefOrGetter<string>,
  options: UseCollectionOptions = {},
): CollectionFeed {
  const { pageSize = 12 } = options
  const client = useStorefront()

  const products = shallowRef<readonly ProductSummary[]>([])
  const error = shallowRef<StorefrontError | null>(null)
  const loading = ref(false)
  const cursor = shallowRef<string | null>(null)
  const exhausted = ref(false)
  const collectionTitle = ref('')

  const title = computed(() => collectionTitle.value)
  const hasNextPage = computed(() => !exhausted.value)

  /**
   * Invalidates in-flight loads. A boolean `loading` flag alone is not enough:
   * when the handle changes mid-request, `reset()` must both release the guard
   * so the new collection is actually fetched, and mark the outstanding
   * response stale so it cannot write the previous collection's products over
   * the new one. This is the same protection `useStorefrontQuery` applies with
   * its request token.
   */
  let generation = 0

  /**
   * Fetches one page.
   *
   * @param after - Cursor, or null for the first page.
   * @param append - Append to the loaded products, or replace them.
   */
  async function load(after: string | null, append: boolean): Promise<void> {
    if (loading.value) return
    const current = (generation += 1)
    loading.value = true
    const result = await client.getCollection({ handle: toValue(handle), first: pageSize, after })
    if (current !== generation) return
    loading.value = false
    if (!result.ok) {
      error.value = result.error
      return
    }
    error.value = null
    collectionTitle.value = result.value.title
    cursor.value = result.value.endCursor
    exhausted.value = !result.value.hasNextPage
    products.value = append ? [...products.value, ...result.value.products] : result.value.products
  }

  async function loadMore(): Promise<void> {
    if (exhausted.value || cursor.value === null) return
    await load(cursor.value, true)
  }

  async function reset(): Promise<void> {
    generation += 1
    loading.value = false
    products.value = []
    cursor.value = null
    exhausted.value = false
    await load(null, false)
  }

  watch(
    () => toValue(handle),
    () => void reset(),
  )
  void reset()

  return { products, title, error, loading, hasNextPage, loadMore, reset }
}
