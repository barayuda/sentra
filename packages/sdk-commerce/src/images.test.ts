import { describe, expect, it } from 'vitest'
import { shopifyImageSrcset, shopifyImageUrl } from './images.ts'

const BASE = 'https://cdn.shopify.com/s/files/1/0001/mug.jpg'

describe('shopifyImageUrl', () => {
  it('appends the requested width', () => {
    expect(shopifyImageUrl(BASE, { width: 400 })).toBe(`${BASE}?width=400`)
  })

  it('appends height and crop when given', () => {
    const result = new URL(shopifyImageUrl(BASE, { width: 400, height: 400, crop: 'center' }))
    expect(result.searchParams.get('width')).toBe('400')
    expect(result.searchParams.get('height')).toBe('400')
    expect(result.searchParams.get('crop')).toBe('center')
  })

  it('preserves existing query parameters such as the CDN version', () => {
    const versioned = `${BASE}?v=1700000000`
    const result = new URL(shopifyImageUrl(versioned, { width: 800 }))
    expect(result.searchParams.get('v')).toBe('1700000000')
    expect(result.searchParams.get('width')).toBe('800')
  })

  it('overwrites a width already present rather than duplicating it', () => {
    const result = shopifyImageUrl(`${BASE}?width=100`, { width: 800 })
    expect(result.match(/width=/g)).toHaveLength(1)
    expect(new URL(result).searchParams.get('width')).toBe('800')
  })

  it('returns a non-URL input unchanged instead of throwing', () => {
    expect(shopifyImageUrl('not a url', { width: 400 })).toBe('not a url')
  })
})

describe('shopifyImageSrcset', () => {
  it('builds a srcset with one candidate per width', () => {
    expect(shopifyImageSrcset(BASE, [400, 800])).toBe(
      `${BASE}?width=400 400w, ${BASE}?width=800 800w`,
    )
  })

  it('returns an empty string when given no widths', () => {
    expect(shopifyImageSrcset(BASE, [])).toBe('')
  })
})
