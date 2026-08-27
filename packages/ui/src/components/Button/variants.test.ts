import { describe, expect, it } from 'vitest'
import { SIZE_CLASSES } from '../../shared/controls.ts'
import { buttonClasses } from './variants.ts'

const ALL_VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const

describe('buttonClasses', () => {
  it('applies the brand background for the primary variant', () => {
    expect(buttonClasses('primary', 'md')).toContain('bg-brand-600')
  })

  it('applies the danger background for the danger variant', () => {
    expect(buttonClasses('danger', 'md')).toContain('bg-danger-500')
  })

  it('gives the ghost variant no brand background', () => {
    expect(buttonClasses('ghost', 'md')).not.toContain('bg-brand-600')
  })

  it('includes the size classes for the requested size', () => {
    expect(buttonClasses('primary', 'lg')).toContain(SIZE_CLASSES.lg)
  })

  it('includes a visible focus ring for every variant', () => {
    for (const variant of ALL_VARIANTS) {
      expect(buttonClasses(variant, 'md')).toContain('focus-visible:outline')
    }
  })

  it('includes disabled styling for every variant so they degrade consistently', () => {
    for (const variant of ALL_VARIANTS) {
      expect(buttonClasses(variant, 'md')).toContain('disabled:opacity-50')
    }
  })
})
