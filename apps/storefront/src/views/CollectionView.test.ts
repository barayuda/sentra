import type { CollectionPage, StorefrontClient, StorefrontResult } from '@sentra/sdk-commerce'
import { STOREFRONT_INJECTION_KEY } from '@sentra/sdk-commerce/vue'
import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import CollectionView from './CollectionView.vue'

function page(count: number, hasNextPage: boolean): CollectionPage {
  return {
    handle: 'tableware',
    title: 'Tableware',
    hasNextPage,
    endCursor: hasNextPage ? 'cursor-1' : null,
    products: Array.from({ length: count }, (_, index) => ({
      id: `gid://shopify/Product/${index}`,
      handle: `sentra-piece-${index}`,
      title: `Piece ${index}`,
      availableForSale: true,
      price: { amount: '19.00', currencyCode: 'USD' as const },
      image: null,
    })),
  }
}

/** Renders the view with a stub client provided. */
function renderView(getCollection: StorefrontClient['getCollection']) {
  return render(CollectionView, {
    global: {
      provide: { [STOREFRONT_INJECTION_KEY as unknown as string]: { getCollection } },
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

describe('CollectionView', () => {
  it('shows a loading state before the first page arrives', async () => {
    const { getByTestId } = renderView(() => new Promise(() => {}))
    expect(getByTestId('state-loading')).toBeTruthy()
  })

  it('renders the collection title and its products', async () => {
    const { findByText, getByRole } = renderView(async () => ({ ok: true, value: page(6, false) }))
    expect(await findByText('Tableware')).toBeTruthy()
    expect(getByRole('list')).toBeTruthy()
  })

  it('shows an empty state for a collection with no products', async () => {
    const { findByTestId } = renderView(async () => ({ ok: true, value: page(0, false) }))
    expect(await findByTestId('state-empty')).toBeTruthy()
  })

  it('shows a retryable error state when the first page fails', async () => {
    const { findByTestId, getByRole } = renderView(async () => ({
      ok: false,
      error: { kind: 'network', message: 'down', attempts: 3, status: null },
    }))
    expect(await findByTestId('state-error')).toBeTruthy()
    expect(getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('retries the failed load when the retry button is pressed', async () => {
    const getCollection = vi
      .fn<StorefrontClient['getCollection']>()
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: 'network', message: 'down', attempts: 3, status: null },
      } as StorefrontResult<CollectionPage>)
      .mockResolvedValue({ ok: true, value: page(3, false) })

    const { findByRole, findByText } = renderView(getCollection)
    const retry = await findByRole('button', { name: /try again/i })
    retry.click()
    expect(await findByText('Tableware')).toBeTruthy()
  })

  it('does not show a retry button for a non-retryable failure', async () => {
    const { findByTestId, queryByRole } = renderView(async () => ({
      ok: false,
      error: { kind: 'schema', message: 'drifted', path: '$.collection' },
    }))
    await findByTestId('state-error')
    expect(queryByRole('button', { name: /try again/i })).toBeNull()
  })
})
