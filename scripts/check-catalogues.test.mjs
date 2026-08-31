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

  it('fails an added placeholder the reference does not have', () => {
    const problems = checkGroup('ui', {
      en: { sortBy: 'Sort by {column}' },
      id: { sortBy: 'Urutkan {column} {extra}' },
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/sortBy.*adds placeholder.*extra/)
  })

  it('fails a translated plural message with no other branch', () => {
    const problems = checkGroup('ui', {
      en: { items: { one: '{count} item', other: '{count} items' } },
      id: { items: { one: '{count} barang' } },
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/items.*no "other" branch/)
  })

  /* M2 gap 1: a stray locale must be rejected for existing, not merely
     parity-checked against `en` and passed because it happens to match. */
  it('fails a locale outside the supported en/id set, even when it parity-checks cleanly', () => {
    const problems = checkGroup('ui', {
      en: reference,
      id: { greeting: 'Halo', sortBy: 'Urutkan {column}' },
      fr: { greeting: 'Bonjour', sortBy: 'Trier par {column}' },
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toBe('ui: unexpected locale "fr" — only en, id are supported')
  })

  /* M2 gap 2: `typeof message === 'object'` silently skips a plural-shaped
     key that a translation replaced with a plain string, instead of
     flagging the shape mismatch. */
  it('fails a plural-shaped key replaced by a plain string in a translation', () => {
    const problems = checkGroup('ui', {
      en: { items: { one: '{count} item', other: '{count} items' } },
      id: { items: 'barang' },
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toBe(
      'ui: id.json "items" is a plain string, but en.json "items" is a plural object',
    )
  })

  it('fails a plain-string key replaced by a plural object in a translation', () => {
    const problems = checkGroup('ui', {
      en: { greeting: 'Hello' },
      id: { greeting: { other: 'Halo' } },
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toBe(
      'ui: id.json "greeting" is a plural object, but en.json "greeting" is a plain string',
    )
  })
})
