import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OVERRIDES_STORAGE_KEY, readOverrides } from './overrides.ts'

/**
 * Sets the address bar's query string via `window.history.replaceState`, the
 * in-repo precedent for controlling `window.location.search` under
 * happy-dom (see `apps/shell/src/registry/boot.test.ts`). `vi.stubGlobal`
 * on `location` is avoided deliberately: it replaces the whole object, which
 * does not compose with resetting state per-test.
 */
function setQuery(search: string): void {
  window.history.replaceState(null, '', search ? `/?${search}` : '/')
}

/*
 * `readOverrides` reads `window.location.search` and `localStorage`, both of
 * which are shared across every test in this file. Without an explicit
 * reset, a query string or storage entry left behind by one test changes
 * what a later test is actually exercising — an "empty result" assertion
 * could pass because a stale value happens to match, not because the code
 * is correct.
 */
beforeEach(() => {
  setQuery('')
  localStorage.clear()
})

describe('readOverrides — disabled (allowOverrides: false)', () => {
  it('ignores a query override, returning an empty result', () => {
    setQuery('ff_x=1')
    expect(readOverrides(false)).toEqual({})
  })

  it('ignores a populated localStorage override, returning an empty result', () => {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify({ x: true }))
    expect(readOverrides(false)).toEqual({})
  })

  it('never reads localStorage at all — not merely "reads and ignores"', () => {
    /* A "read and ignore" implementation could still pass the two tests
       above by discarding the result after parsing it. Asserting the
       storage API itself was never touched is the only way to distinguish
       that from the required behaviour: return {} before reading anything.
       Spying on the `localStorage` instance itself, rather than
       `Storage.prototype`, matters here: happy-dom's `Storage` is a Proxy
       that permanently binds each accessed method onto the instance the
       first time it is read (see happy-dom's `ClassMethodBinder`), so a
       prototype-level spy installed after any earlier test's first
       `getItem` call — including one made by a buggy implementation under
       test — would silently stop observing this instance's calls. */
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify({ x: true }))
    const getItem = vi.spyOn(localStorage, 'getItem')
    readOverrides(false)
    expect(getItem).not.toHaveBeenCalled()
    getItem.mockRestore()
  })
})

describe('readOverrides — enabled (allowOverrides: true)', () => {
  it('reads a truthy query override', () => {
    setQuery('ff_x=1')
    expect(readOverrides(true)).toEqual({ x: true })
  })

  it('reads a falsy query override', () => {
    setQuery('ff_x=0')
    expect(readOverrides(true)).toEqual({ x: false })
  })

  it('merges a localStorage JSON object', () => {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify({ x: true, y: false }))
    expect(readOverrides(true)).toEqual({ x: true, y: false })
  })

  it('returns an empty result for malformed localStorage JSON rather than throwing', () => {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, '{not json')
    expect(() => readOverrides(true)).not.toThrow()
    expect(readOverrides(true)).toEqual({})
  })

  /*
   * These two precedence cases MUST use conflicting values. If both sources
   * agreed (e.g. query `?ff_x=1` and storage `{ x: true }`), a
   * `readOverrides` with its precedence silently reversed would still
   * return `{ x: true }` and both tests would pass — proving only that
   * *something* set the flag, not that the query specifically won. Setting
   * opposite values, and then swapping them, is what actually pins down
   * which source wins.
   */
  it('prefers the query over localStorage when they disagree', () => {
    setQuery('ff_x=0')
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify({ x: true }))
    expect(readOverrides(true)).toEqual({ x: false })
  })

  it('prefers the query over localStorage when they disagree, values swapped', () => {
    setQuery('ff_x=1')
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify({ x: false }))
    expect(readOverrides(true)).toEqual({ x: true })
  })
})
