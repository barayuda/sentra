import { describe, expect, it } from 'vitest'
import { mergeMessages } from './merge.ts'

describe('mergeMessages', () => {
  it('merges catalogues within a locale', () => {
    const merged = mergeMessages({ en: { a: 'A' } }, { en: { b: 'B' } })
    expect(merged.en).toEqual({ a: 'A', b: 'B' })
  })

  it('unions locales present in only one source', () => {
    const merged = mergeMessages({ en: { a: 'A' } }, { id: { b: 'B' } })
    expect(Object.keys(merged).sort()).toEqual(['en', 'id'])
  })

  it('throws on a duplicate key within a locale', () => {
    expect(() => mergeMessages({ en: { a: 'A' } }, { en: { a: 'other' } })).toThrow(
      /duplicate message key "a" in locale "en"/,
    )
  })

  it('allows the same key in different locales', () => {
    expect(() => mergeMessages({ en: { a: 'A' } }, { id: { a: 'A' } })).not.toThrow()
  })
})
