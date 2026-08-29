import { describe, expect, it } from 'vitest'
import { err, isErr, isOk, ok, type Result } from './result.ts'

describe('Result', () => {
  it('narrows to the value on ok', () => {
    const result: Result<number, string> = ok(3)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.value).toBe(3)
  })

  it('narrows to the error on err', () => {
    const result: Result<number, string> = err('boom')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toBe('boom')
  })

  it('exposes guards that narrow without a manual property check', () => {
    const results: Result<number, string>[] = [ok(1), err('nope'), ok(2)]
    expect(results.filter(isOk).map((result) => result.value)).toEqual([1, 2])
    expect(results.filter(isErr).map((result) => result.error)).toEqual(['nope'])
  })
})
