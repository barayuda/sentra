import { describe, expect, it } from 'vitest'
import { renderCss } from './css.ts'

describe('renderCss', () => {
  it('places Tailwind theme namespaces inside @theme', () => {
    const css = renderCss([{ name: '--color-brand-500', value: '#0ea5e9' }])
    expect(css).toMatch(/@theme \{\n {2}--color-brand-500: #0ea5e9;\n\}/)
  })

  it('places non-theme namespaces inside :root', () => {
    const css = renderCss([{ name: '--z-index-modal', value: '1000' }])
    expect(css).toMatch(/:root \{\n {2}--z-index-modal: 1000;\n\}/)
    expect(css).not.toContain('@theme')
  })

  it('emits both blocks when both kinds are present', () => {
    const css = renderCss([
      { name: '--color-brand-500', value: '#0ea5e9' },
      { name: '--z-index-modal', value: '1000' },
    ])
    expect(css).toContain('@theme {')
    expect(css).toContain(':root {')
    expect(css.indexOf('@theme')).toBeLessThan(css.indexOf(':root'))
  })

  it('omits a block entirely when it would be empty', () => {
    expect(renderCss([{ name: '--radius-md', value: '0.5rem' }])).not.toContain(':root')
  })

  it('returns an empty string for no variables', () => {
    expect(renderCss([])).toBe('')
  })
})
