import { describe, expect, it } from 'vitest'
import { asUnsafeHtml } from './types.ts'

describe('asUnsafeHtml', () => {
  it('passes the string through unchanged', () => {
    const raw = '<p>Hand-made <strong>ceramics</strong></p>'
    expect(asUnsafeHtml(raw)).toBe(raw)
  })

  it('produces a value still usable as a string', () => {
    expect(asUnsafeHtml('abc').length).toBe(3)
  })
})
