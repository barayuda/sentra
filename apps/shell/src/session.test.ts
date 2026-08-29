import { afterEach, describe, expect, it } from 'vitest'
import { initialSession, setSessionRole } from './session.ts'

const ROLE_STORAGE_KEY = 'sentra:role'

afterEach(() => {
  localStorage.clear()
})

describe('initialSession', () => {
  it('reads a valid stored role at boot', () => {
    localStorage.setItem(ROLE_STORAGE_KEY, 'ops')
    expect(initialSession().role).toBe('ops')
  })

  it('falls back to shopper when no key is stored', () => {
    localStorage.removeItem(ROLE_STORAGE_KEY)
    expect(initialSession().role).toBe('shopper')
  })

  /*
   * A stored value outside the `Role` union must never be trusted verbatim —
   * that value ends up on `RouteMeta.requiresRole` comparisons and, per
   * `guards.ts`, would only ever grant access if it happened to equal a
   * route's requirement. `initialSession` must reject anything that is not
   * exactly one of `SHELL_ROLES` and fall back to `shopper`. Named risk area:
   * access control (an unvalidated stored value is an unvalidated input).
   */
  it.each(['admin', '', 'OPS'])('falls back to shopper for an out-of-union value %j', (stored) => {
    localStorage.setItem(ROLE_STORAGE_KEY, stored)
    expect(initialSession().role).toBe('shopper')
  })

  it('returns the Session shape — id, displayName, role — never userId', () => {
    localStorage.removeItem(ROLE_STORAGE_KEY)
    const session = initialSession()
    expect(Object.keys(session).sort()).toEqual(['displayName', 'id', 'role'])
    expect('userId' in session).toBe(false)
  })
})

describe('setSessionRole', () => {
  it('persists the role under the literal key sentra:role', () => {
    setSessionRole('ops')
    expect(localStorage.getItem('sentra:role')).toBe('ops')
  })
})
