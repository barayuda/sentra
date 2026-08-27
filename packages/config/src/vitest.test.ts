import { describe, expect, it } from 'vitest'
import { defineVitestConfig } from './vitest.ts'

describe('defineVitestConfig', () => {
  it('defaults to the node environment', () => {
    expect(defineVitestConfig().test.environment).toBe('node')
  })

  it('accepts a DOM environment override', () => {
    expect(defineVitestConfig({ environment: 'happy-dom' }).test.environment).toBe('happy-dom')
  })

  it('defaults to no setup files', () => {
    expect(defineVitestConfig().test.setupFiles).toEqual([])
  })

  it('passes setup files through', () => {
    expect(defineVitestConfig({ setupFiles: ['./setup.ts'] }).test.setupFiles).toEqual([
      './setup.ts',
    ])
  })

  it('enables v8 coverage so CI can gate on it', () => {
    expect(defineVitestConfig().test.coverage.provider).toBe('v8')
  })
})
