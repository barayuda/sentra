import { describe, expect, it } from 'vitest'
import { buildTokensCss, tokens } from './tokens.ts'
import { flattenTokens } from './flatten.ts'

describe('tokens', () => {
  it('defines a brand colour scale', () => {
    expect(tokens.color).toBeTypeOf('object')
    expect(flattenTokens(tokens).map((v) => v.name)).toContain('--color-brand-500')
  })

  it('defines a semantic danger colour so components need no hard-coded hex', () => {
    expect(flattenTokens(tokens).map((v) => v.name)).toContain('--color-danger-500')
  })

  it('generates no duplicate custom property names', () => {
    const names = flattenTokens(tokens).map((v) => v.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('emits only well-formed custom property names', () => {
    for (const { name } of flattenTokens(tokens)) {
      expect(name).toMatch(/^--[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })
})

describe('buildTokensCss', () => {
  it('emits a @theme block for Tailwind-derived utilities', () => {
    expect(buildTokensCss()).toContain('@theme {')
  })

  it('emits a :root block for non-theme tokens', () => {
    expect(buildTokensCss()).toContain(':root {')
  })

  it('is deterministic across calls so the build produces stable diffs', () => {
    expect(buildTokensCss()).toBe(buildTokensCss())
  })
})
