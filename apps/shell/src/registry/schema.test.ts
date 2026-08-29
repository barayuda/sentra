import { describe, expect, it } from 'vitest'
import { mergeEventSchemas } from './schema.ts'

describe('mergeEventSchemas', () => {
  it('unions disjoint schemas', () => {
    const merged = mergeEventSchemas([{ a: ['x'] }, { b: ['y'] }])
    expect(Object.keys(merged).sort()).toEqual(['a', 'b'])
  })

  it('permits an event two remotes declare identically', () => {
    const merged = mergeEventSchemas([{ page_view: ['navigation'] }, { page_view: ['navigation'] }])
    expect(merged.page_view).toEqual(['navigation'])
  })

  it('throws when two remotes disagree about an event', () => {
    expect(() =>
      mergeEventSchemas([{ page_view: ['navigation'] }, { page_view: ['nav'] }]),
    ).toThrow(/page_view/)
  })

  it('names both categories in the message so the fix is obvious', () => {
    expect(() =>
      mergeEventSchemas([{ page_view: ['navigation'] }, { page_view: ['nav'] }]),
    ).toThrow(/navigation.*nav|nav.*navigation/)
  })

  it('returns an empty schema for no remotes', () => {
    expect(mergeEventSchemas([])).toEqual({})
  })
})
