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

  it('excludes Playwright specs when excludeE2E is set', () => {
    const config = defineVitestConfig({ excludeE2E: true })
    expect(config.test.exclude).toEqual(['e2e/**', 'e2e-platform-only/**', 'node_modules/**'])
  })

  it('sets no exclude by default, so Vitest keeps its own defaults', () => {
    expect(defineVitestConfig().test.exclude).toBeUndefined()
  })

  it('still excludes node_modules alongside e2e, because naming exclude replaces the default', () => {
    expect(defineVitestConfig({ excludeE2E: true }).test.exclude).toContain('node_modules/**')
  })

  it('excludes the platform-only suite too, which lives outside e2e/', () => {
    expect(defineVitestConfig({ excludeE2E: true }).test.exclude).toContain('e2e-platform-only/**')
  })
})
