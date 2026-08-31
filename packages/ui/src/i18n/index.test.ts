import { describe, expect, it } from 'vitest'
import { uiMessages } from './index.ts'

describe('uiMessages', () => {
  it('ships both locales', () => {
    expect(Object.keys(uiMessages).sort()).toEqual(['en', 'id'])
  })

  it('translates every English key', () => {
    /*
     * `Messages` is `Record<string, Catalogue>`, so `noUncheckedIndexedAccess`
     * types `.en`/`.id` as possibly `undefined`. Both are always present here
     * (the previous test pins that); the assertions below are what would fail
     * if that ever stopped being true.
     */
    expect(Object.keys(uiMessages.id!).sort()).toEqual(Object.keys(uiMessages.en!).sort())
  })

  it('namespaces every key under ui.', () => {
    for (const key of Object.keys(uiMessages.en!)) {
      expect(key.startsWith('ui.')).toBe(true)
    }
  })
})
