import { describe, expect, it } from 'vitest'
import { buildTokensCss, darkTokens, tokens } from './tokens.ts'
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

describe('darkTokens', () => {
  it('overrides only existing token paths', () => {
    const base = new Set(flattenTokens(tokens).map((v) => v.name))
    for (const variable of flattenTokens(darkTokens)) {
      expect(base.has(variable.name), `${variable.name} has no light counterpart`).toBe(true)
    }
  })

  it('inverts the neutral ramp', () => {
    const dark = Object.fromEntries(flattenTokens(darkTokens).map((v) => [v.name, v.value]))
    expect(dark['--color-neutral-50']).toBeDefined()
    expect(dark['--color-neutral-900']).toBeDefined()
  })
})

describe('buildTokensCss with modes', () => {
  const css = buildTokensCss()

  it('emits the dark override block after the theme block', () => {
    expect(css).toContain(":root[data-theme='dark'] {")
    expect(css.indexOf('@theme')).toBeLessThan(css.indexOf("[data-theme='dark']"))
  })

  it('emits the compact density block', () => {
    expect(css).toContain("[data-density='compact'] {")
  })

  it('declares the dark custom variant exactly once', () => {
    expect(css.match(/@custom-variant dark/g)).toHaveLength(1)
  })
})
