import { describe, expect, it } from 'vitest'
import { flattenTokens } from './flatten.ts'

describe('flattenTokens', () => {
  it('joins nested keys into a single custom property name', () => {
    expect(flattenTokens({ color: { brand: { 500: '#0ea5e9' } } })).toEqual([
      { name: '--color-brand-500', value: '#0ea5e9' },
    ])
  })

  it('converts camelCase keys to kebab-case', () => {
    expect(flattenTokens({ zIndex: { modal: 1000 } })).toEqual([
      { name: '--z-index-modal', value: '1000' },
    ])
  })

  it('stringifies numeric values', () => {
    expect(flattenTokens({ duration: { fast: 150 } })).toEqual([
      { name: '--duration-fast', value: '150' },
    ])
  })

  it('emits one variable per leaf across multiple branches', () => {
    const result = flattenTokens({
      color: { brand: { 500: '#0ea5e9' }, neutral: { 900: '#111827' } },
      radius: { md: '0.5rem' },
    })
    expect(result).toHaveLength(3)
    expect(result.map((v) => v.name)).toEqual([
      '--color-brand-500',
      '--color-neutral-900',
      '--radius-md',
    ])
  })

  it('returns an empty list for an empty tree', () => {
    expect(flattenTokens({})).toEqual([])
  })
})
