import { describe, expect, it } from 'vitest'
import { storefrontRoutes } from './routes.ts'

describe('storefrontRoutes', () => {
  it('exposes only relative paths so a host can mount them anywhere', () => {
    for (const route of storefrontRoutes) {
      expect(route.path.startsWith('/')).toBe(false)
    }
  })

  it('keeps the names the existing views navigate by', () => {
    expect(storefrontRoutes.map((route) => route.name)).toEqual(['collection', 'product'])
  })
})
