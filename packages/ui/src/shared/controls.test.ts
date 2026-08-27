import { describe, expect, it } from 'vitest'
import { FIELD_CLASSES, FOCUS_CLASSES, SIZE_CLASSES } from './controls.ts'

describe('SIZE_CLASSES', () => {
  it('defines every size', () => {
    expect(Object.keys(SIZE_CLASSES).sort()).toEqual(['lg', 'md', 'sm'])
  })

  it('gives each size a distinct class string so controls actually differ', () => {
    const values = Object.values(SIZE_CLASSES)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('FOCUS_CLASSES', () => {
  it('uses focus-visible so pointer users get no ring but keyboard users do', () => {
    expect(FOCUS_CLASSES).toContain('focus-visible:outline')
    expect(FOCUS_CLASSES).not.toMatch(/(^|\s)focus:/)
  })
})

describe('FIELD_CLASSES', () => {
  it('includes a border so text fields are visually delimited', () => {
    expect(FIELD_CLASSES).toContain('border')
  })

  it('includes disabled styling shared by every field', () => {
    expect(FIELD_CLASSES).toContain('disabled:opacity-50')
  })
})
