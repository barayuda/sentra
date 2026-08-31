import { describe, expect, it } from 'vitest'
import { checkGroup, placeholdersOf } from './check-catalogues.mjs'

describe('placeholdersOf', () => {
  it('collects named placeholders from a string', () => {
    expect([...placeholdersOf('Sort by {column} in {order}')].sort()).toEqual(['column', 'order'])
  })

  it('collects across every plural branch', () => {
    expect([...placeholdersOf({ one: '{count} item', other: '{count} items' })]).toEqual(['count'])
  })

  it('returns an empty set for a message with no placeholders', () => {
    expect([...placeholdersOf('Hello')]).toEqual([])
  })
})

describe('checkGroup', () => {
  const reference = { greeting: 'Hello', sortBy: 'Sort by {column}' }

  it('passes a faithful translation', () => {
    expect(
      checkGroup('ui', { en: reference, id: { greeting: 'Halo', sortBy: 'Urutkan {column}' } }),
    ).toEqual([])
  })

  it('fails a dropped placeholder', () => {
    const problems = checkGroup('ui', {
      en: reference,
      id: { greeting: 'Halo', sortBy: 'Urutkan' },
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/sortBy.*placeholder.*column/)
  })

  it('fails an extra key the reference does not have', () => {
    const problems = checkGroup('ui', {
      en: reference,
      id: { greeting: 'Halo', sortBy: 'Urutkan {column}', extra: 'X' },
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/extra/)
  })

  it('fails a missing key', () => {
    const problems = checkGroup('ui', { en: reference, id: { greeting: 'Halo' } })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/sortBy/)
  })

  it('fails a plural message with no other branch', () => {
    const problems = checkGroup('ui', {
      en: { items: { one: '{count} item' } },
      id: { items: { other: '{count} barang' } },
    })
    expect(problems.some((p) => /other/.test(p))).toBe(true)
  })

  it('fails a group with only a reference locale', () => {
    const problems = checkGroup('ui', { en: reference })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/single-locale/)
  })

  it('fails a group with no reference locale', () => {
    const problems = checkGroup('ui', { id: { greeting: 'Halo' } })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/en\.json/)
  })
})
