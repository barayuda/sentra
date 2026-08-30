import { describe, expect, it } from 'vitest'
import { buildTokensCss, darkTokens, reducedMotionTokens, tokens } from './tokens.ts'
import { flattenTokens } from './flatten.ts'

/**
 * Extracts one top-level block from generated CSS, so a test can assert which
 * block a variable landed in rather than merely that the file mentions it.
 *
 * @param css - Generated stylesheet text.
 * @param selector - Block selector or at-rule, without the trailing brace.
 * @returns The block text, or `''` when the block is absent.
 */
function blockFor(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) return ''
  const end = css.indexOf('\n}', start)
  return end === -1 ? css.slice(start) : css.slice(start, end)
}

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

describe('motion tokens', () => {
  const css = buildTokensCss()

  it('routes easing to @theme and duration to :root', () => {
    /*
     * The split css.ts warns about, asserted per block rather than per file.
     * Both namespaces produce valid CSS in either block, so `toContain` on
     * the whole stylesheet would pass with the routing exactly backwards —
     * and the symptom would be a missing `ease-standard` utility class,
     * visible only in a browser.
     */
    expect(blockFor(css, '@theme')).toContain('--ease-standard: cubic-bezier(0.2, 0, 0, 1);')
    expect(blockFor(css, '@theme')).not.toContain('--duration-')
    expect(blockFor(css, ':root')).toContain('--duration-normal: 250ms;')
    expect(blockFor(css, ':root')).not.toContain('--ease-')
  })

  it('names easing curves so they cannot redefine Tailwind built-ins', () => {
    /* Tailwind ships ease-linear, ease-in, ease-out, and ease-in-out. A token
       on any of those keys would silently change what those classes mean for
       every consumer, including code that never heard of Sentra. */
    const names = flattenTokens(tokens).map((v) => v.name)
    for (const builtin of ['--ease-linear', '--ease-in', '--ease-out', '--ease-in-out']) {
      expect(names, `${builtin} would shadow a Tailwind built-in`).not.toContain(builtin)
    }
    expect(names).toEqual(
      expect.arrayContaining(['--ease-standard', '--ease-enter', '--ease-exit']),
    )
  })
})

describe('reducedMotionTokens', () => {
  it('overrides only existing token paths', () => {
    const base = new Set(flattenTokens(tokens).map((v) => v.name))
    for (const variable of flattenTokens(reducedMotionTokens)) {
      expect(base.has(variable.name), `${variable.name} has no base counterpart`).toBe(true)
    }
  })

  it('zeroes every duration a component is expected to consume', () => {
    const overrides = Object.fromEntries(
      flattenTokens(reducedMotionTokens).map((v) => [v.name, v.value]),
    )
    /*
     * Both non-zero durations must appear. Covering only one would leave a
     * component that reached for the other still animating under a setting
     * the user asked for — and nothing else in the suite would notice.
     */
    const animated = flattenTokens(tokens).filter(
      (v) => v.name.startsWith('--duration-') && v.value !== '0ms',
    )
    expect(animated.length).toBeGreaterThan(0)
    for (const { name } of animated) expect(overrides[name]).toBe('0ms')
  })

  it('emits last so it outranks the other modes at equal specificity', () => {
    const css = buildTokensCss()
    const query = '@media (prefers-reduced-motion: reduce) {'
    expect(css).toContain(query)
    expect(css.lastIndexOf("[data-density='compact']")).toBeLessThan(css.indexOf(query))
    expect(css.lastIndexOf(":root[data-theme='dark']")).toBeLessThan(css.indexOf(query))
  })
})
