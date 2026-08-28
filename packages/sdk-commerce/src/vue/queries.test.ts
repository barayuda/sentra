/**
 * @vitest-environment happy-dom
 */
import { createApp, effectScope, nextTick, ref, type App } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { StorefrontClient } from '../client.ts'
import type { StorefrontResult } from '../errors.ts'
import type { CollectionPage, ProductDetail } from '../types.ts'
import { STOREFRONT_INJECTION_KEY } from './plugin.ts'
import { useCollection, useProduct, useStorefrontQuery } from './queries.ts'

/**
 * Runs a composable inside an app context and an effect scope, so `inject` and
 * `watch` behave exactly as they would in a component — and so stopping the
 * scope disposes the watchers instead of leaking them between tests.
 */
function withStorefront<T>(
  client: Partial<StorefrontClient>,
  composable: () => T,
): { result: T; app: App; stop: () => void } {
  const app = createApp({ render: () => null })
  app.provide(STOREFRONT_INJECTION_KEY, client as StorefrontClient)
  const scope = effectScope()
  const result = scope.run(() => app.runWithContext(composable)) as T
  return { result, app, stop: () => scope.stop() }
}

function summary(id: string) {
  return {
    id,
    handle: `handle-${id}`,
    title: `Product ${id}`,
    availableForSale: true,
    price: { amount: '19.00', currencyCode: 'USD' as const },
    image: null,
  }
}

function page(ids: string[], hasNextPage: boolean, endCursor: string | null): CollectionPage {
  return {
    handle: 'tableware',
    title: 'Tableware',
    products: ids.map(summary),
    hasNextPage,
    endCursor,
  }
}

describe('useStorefrontQuery', () => {
  it('loads immediately and clears loading when done', async () => {
    const loader = vi.fn(async (): Promise<StorefrontResult<number>> => ({ ok: true, value: 7 }))
    const { result, stop } = withStorefront({}, () => useStorefrontQuery(loader))

    await vi.waitFor(() => expect(result.loading.value).toBe(false))
    expect(result.data.value).toBe(7)
    expect(result.error.value).toBeNull()
    expect(loader).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not load when immediate is false', async () => {
    const loader = vi.fn(async (): Promise<StorefrontResult<number>> => ({ ok: true, value: 7 }))
    const { result, stop } = withStorefront({}, () =>
      useStorefrontQuery(loader, { immediate: false }),
    )

    await nextTick()
    expect(loader).not.toHaveBeenCalled()
    expect(result.data.value).toBeNull()
    stop()
  })

  it('captures a typed error', async () => {
    const { result, stop } = withStorefront({}, () =>
      useStorefrontQuery(
        async (): Promise<StorefrontResult<number>> => ({
          ok: false,
          error: { kind: 'throttled', message: 'slow down', attempts: 3, throttleStatus: null },
        }),
        { immediate: false },
      ),
    )

    await result.refresh()
    expect(result.error.value?.kind).toBe('throttled')
    expect(result.loading.value).toBe(false)
    stop()
  })

  it('keeps the previous data when a refresh fails', async () => {
    let succeed = true
    const { result, stop } = withStorefront({}, () =>
      useStorefrontQuery(
        async (): Promise<StorefrontResult<number>> =>
          succeed
            ? { ok: true, value: 1 }
            : { ok: false, error: { kind: 'network', message: 'down', attempts: 1, status: null } },
        { immediate: false },
      ),
    )

    await result.refresh()
    expect(result.data.value).toBe(1)
    succeed = false
    await result.refresh()
    /* Stale data beats an empty screen: the user keeps seeing the catalogue
       while an error banner explains the refresh failed. */
    expect(result.data.value).toBe(1)
    expect(result.error.value?.kind).toBe('network')
    stop()
  })

  it('clears a previous error on a successful refresh', async () => {
    let succeed = false
    const { result, stop } = withStorefront({}, () =>
      useStorefrontQuery(
        async (): Promise<StorefrontResult<number>> =>
          succeed
            ? { ok: true, value: 2 }
            : { ok: false, error: { kind: 'network', message: 'down', attempts: 1, status: null } },
        { immediate: false },
      ),
    )

    await result.refresh()
    expect(result.error.value).not.toBeNull()
    succeed = true
    await result.refresh()
    expect(result.error.value).toBeNull()
    stop()
  })

  it('ignores a superseded response', async () => {
    const resolvers: ((value: StorefrontResult<string>) => void)[] = []
    const { result, stop } = withStorefront({}, () =>
      useStorefrontQuery(
        () => new Promise<StorefrontResult<string>>((resolve) => resolvers.push(resolve)),
        { immediate: false },
      ),
    )

    const first = result.refresh()
    const second = result.refresh()
    /* Resolve out of order: the slow first request lands after the second. */
    resolvers[1]?.({ ok: true, value: 'second' })
    resolvers[0]?.({ ok: true, value: 'first' })
    await Promise.all([first, second])

    expect(result.data.value).toBe('second')
    stop()
  })

  it('refetches when a watched source changes', async () => {
    const handle = ref('a')
    const loader = vi.fn(async (): Promise<StorefrontResult<string>> => ({
      ok: true,
      value: handle.value,
    }))
    const { result, stop } = withStorefront({}, () =>
      useStorefrontQuery(loader, { watch: () => handle.value }),
    )

    await vi.waitFor(() => expect(result.data.value).toBe('a'))
    handle.value = 'b'
    await vi.waitFor(() => expect(result.data.value).toBe('b'))
    expect(loader).toHaveBeenCalledTimes(2)
    stop()
  })
})

describe('useProduct', () => {
  it('fetches the product for the current handle', async () => {
    const getProduct = vi.fn(async (): Promise<StorefrontResult<ProductDetail | null>> => ({
      ok: true,
      value: null,
    }))
    const handle = ref('stoneware-mug')
    const { stop } = withStorefront({ getProduct }, () => useProduct(handle))

    await vi.waitFor(() => expect(getProduct).toHaveBeenCalledWith({ handle: 'stoneware-mug' }))
    handle.value = 'speckled-bowl'
    await vi.waitFor(() => expect(getProduct).toHaveBeenCalledWith({ handle: 'speckled-bowl' }))
    stop()
  })
})

describe('useCollection', () => {
  it('loads the first page and reports more pages available', async () => {
    const getCollection = vi.fn(async (): Promise<StorefrontResult<CollectionPage>> => ({
      ok: true,
      value: page(['1', '2'], true, 'cursor-2'),
    }))
    const { result, stop } = withStorefront({ getCollection }, () =>
      useCollection('tableware', { pageSize: 2 }),
    )

    await vi.waitFor(() => expect(result.products.value).toHaveLength(2))
    expect(result.title.value).toBe('Tableware')
    expect(result.hasNextPage.value).toBe(true)
    expect(getCollection).toHaveBeenCalledWith({ handle: 'tableware', first: 2, after: null })
    stop()
  })

  it('appends the next page instead of replacing it', async () => {
    const pages = [page(['1', '2'], true, 'cursor-2'), page(['3', '4'], false, null)]
    let call = 0
    const getCollection = vi.fn(async (): Promise<StorefrontResult<CollectionPage>> => {
      const value = pages[call] ?? pages[1]
      call += 1
      return { ok: true, value: value as CollectionPage }
    })
    const { result, stop } = withStorefront({ getCollection }, () =>
      useCollection('tableware', { pageSize: 2 }),
    )

    await vi.waitFor(() => expect(result.products.value).toHaveLength(2))
    await result.loadMore()
    expect(result.products.value.map((product) => product.id)).toEqual(['1', '2', '3', '4'])
    expect(result.hasNextPage.value).toBe(false)
    stop()
  })

  it('sends the cursor when loading more', async () => {
    const getCollection = vi.fn(async (): Promise<StorefrontResult<CollectionPage>> => ({
      ok: true,
      value: page(['1'], true, 'cursor-1'),
    }))
    const { result, stop } = withStorefront({ getCollection }, () =>
      useCollection('tableware', { pageSize: 1 }),
    )

    await vi.waitFor(() => expect(result.products.value).toHaveLength(1))
    await result.loadMore()
    expect(getCollection).toHaveBeenLastCalledWith({
      handle: 'tableware',
      first: 1,
      after: 'cursor-1',
    })
    stop()
  })

  it('does nothing when loadMore is called with no next page', async () => {
    const getCollection = vi.fn(async (): Promise<StorefrontResult<CollectionPage>> => ({
      ok: true,
      value: page(['1'], false, null),
    }))
    const { result, stop } = withStorefront({ getCollection }, () => useCollection('tableware'))

    await vi.waitFor(() => expect(result.products.value).toHaveLength(1))
    await result.loadMore()
    expect(getCollection).toHaveBeenCalledTimes(1)
    stop()
  })

  it('ignores a concurrent loadMore so a page is never fetched twice', async () => {
    /* An infinite scroller fires its trigger on every scroll frame; without a
       guard the same cursor is requested repeatedly and products duplicate. */
    const resolvers: ((value: StorefrontResult<CollectionPage>) => void)[] = []
    const getCollection = vi.fn(
      () => new Promise<StorefrontResult<CollectionPage>>((resolve) => resolvers.push(resolve)),
    )
    const { result, stop } = withStorefront({ getCollection }, () =>
      useCollection('tableware', { pageSize: 1 }),
    )

    resolvers[0]?.({ ok: true, value: page(['1'], true, 'cursor-1') })
    await vi.waitFor(() => expect(result.products.value).toHaveLength(1))

    const a = result.loadMore()
    const b = result.loadMore()
    expect(getCollection).toHaveBeenCalledTimes(2)
    resolvers[1]?.({ ok: true, value: page(['2'], false, null) })
    await Promise.all([a, b])
    expect(result.products.value.map((product) => product.id)).toEqual(['1', '2'])
    stop()
  })

  it('starts over when the handle changes', async () => {
    const handle = ref('tableware')
    const getCollection = vi.fn(async (): Promise<StorefrontResult<CollectionPage>> => ({
      ok: true,
      value: { ...page(['1'], true, 'cursor-1'), handle: handle.value, title: handle.value },
    }))
    const { result, stop } = withStorefront({ getCollection }, () =>
      useCollection(handle, { pageSize: 1 }),
    )

    await vi.waitFor(() => expect(result.products.value).toHaveLength(1))
    handle.value = 'lighting'
    await vi.waitFor(() => expect(result.title.value).toBe('lighting'))
    expect(result.products.value).toHaveLength(1)
    expect(getCollection).toHaveBeenLastCalledWith({ handle: 'lighting', first: 1, after: null })
    stop()
  })

  it('surfaces a failed page load without losing loaded products', async () => {
    let succeed = true
    const getCollection = vi.fn(async (): Promise<StorefrontResult<CollectionPage>> =>
      succeed
        ? { ok: true, value: page(['1'], true, 'cursor-1') }
        : { ok: false, error: { kind: 'network', message: 'down', attempts: 1, status: null } },
    )
    const { result, stop } = withStorefront({ getCollection }, () =>
      useCollection('tableware', { pageSize: 1 }),
    )

    await vi.waitFor(() => expect(result.products.value).toHaveLength(1))
    succeed = false
    await result.loadMore()
    expect(result.error.value?.kind).toBe('network')
    expect(result.products.value).toHaveLength(1)
    stop()
  })
})

describe('useStorefront', () => {
  it('throws a message naming the fix when the plugin is missing', async () => {
    const { useStorefront } = await import('./plugin.ts')
    expect(() => useStorefront()).toThrow(/storefrontPlugin/)
  })
})
