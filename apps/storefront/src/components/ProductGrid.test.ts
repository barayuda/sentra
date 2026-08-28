import type { ProductSummary } from '@sentra/sdk-commerce'
import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import ProductGrid from './ProductGrid.vue'

function product(index: number): ProductSummary {
  return {
    id: `gid://shopify/Product/${index}`,
    handle: `sentra-piece-${index}`,
    title: `Piece ${index}`,
    availableForSale: index % 4 !== 0,
    price: { amount: '19.00', currencyCode: 'USD' },
    image: {
      url: `https://cdn.shopify.com/s/files/1/0001/piece-${index}.jpg`,
      altText: `Piece ${index}`,
      width: 1200,
      height: 1200,
    },
  }
}

const PRODUCTS = Array.from({ length: 24 }, (_, index) => product(index + 1))

describe('ProductGrid', () => {
  it('renders a list with an accessible name', () => {
    const { getByRole } = render(ProductGrid, { props: { products: PRODUCTS } })
    expect(getByRole('list').getAttribute('aria-label')).toBe('Products')
  })

  it('advertises the full product count on each item, even though it renders a window', () => {
    /*
     * Virtualisation hides most rows from the DOM. Without an explicit count a
     * screen-reader user is told the collection has however many items happen
     * to be on screen. Per the ARIA spec, `aria-setsize` belongs on set
     * MEMBERS (`role="listitem"`) — on the `role="list"` container it is
     * inert, so this asserts it on the rendered items rather than the list.
     */
    const { getAllByTestId } = render(ProductGrid, { props: { products: PRODUCTS } })
    const cards = getAllByTestId('product-card')
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.closest('[role="listitem"]')?.getAttribute('aria-setsize')).toBe('24')
    }
  })

  it('gives each item its 1-based position among the full product list', () => {
    const { getAllByTestId } = render(ProductGrid, {
      props: { products: PRODUCTS, heightPx: 2000, rowHeightPx: 100 },
    })
    const items = getAllByTestId('product-card').map((card) => card.closest('[role="listitem"]'))
    /* The third product (index 2) sits in the grid's third position overall. */
    expect(items[2]?.getAttribute('aria-posinset')).toBe('3')
    for (const item of items) {
      expect(item?.getAttribute('aria-setsize')).toBe('24')
    }
  })

  it('renders fewer cards than products, proving virtualisation is active', () => {
    const { getAllByTestId } = render(ProductGrid, {
      props: { products: PRODUCTS, heightPx: 400, rowHeightPx: 320 },
    })
    const rendered = getAllByTestId('product-card').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(PRODUCTS.length)
  })

  it('emits select with the handle when a card is activated', async () => {
    const { getAllByTestId, emitted } = render(ProductGrid, { props: { products: PRODUCTS } })
    const firstCardButton = getAllByTestId('product-card')[0]?.querySelector('button')
    firstCardButton?.click()
    await Promise.resolve()
    expect(emitted().select?.[0]).toEqual(['sentra-piece-1'])
  })

  it('requests CDN-optimised images with a srcset', () => {
    const { getAllByTestId } = render(ProductGrid, { props: { products: PRODUCTS } })
    const image = getAllByTestId('product-card')[0]?.querySelector('img')
    expect(image?.getAttribute('src')).toContain('width=')
    expect(image?.getAttribute('srcset')).toContain('400w')
  })

  it('marks sold-out products with a badge', () => {
    const { getAllByTestId } = render(ProductGrid, { props: { products: [product(4)] } })
    expect(getAllByTestId('product-card')[0]?.textContent).toContain('Sold out')
  })

  it('renders nothing but stays valid for an empty product list', () => {
    const { getByRole, queryAllByTestId } = render(ProductGrid, { props: { products: [] } })
    expect(queryAllByTestId('product-card')).toHaveLength(0)
    expect(getByRole('list')).toBeTruthy()
  })

  it('emits endReached when the last row comes into view', async () => {
    const onEndReached = vi.fn()
    render(ProductGrid, {
      props: {
        products: PRODUCTS.slice(0, 3),
        heightPx: 900,
        rowHeightPx: 100,
        onEndReached,
      },
    })
    await Promise.resolve()
    /* Three products fit in one row-window, so the last row is visible on
       mount and the trigger must fire without any scrolling. */
    expect(onEndReached).toHaveBeenCalled()
  })
})
