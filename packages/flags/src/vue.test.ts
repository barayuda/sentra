import { render, screen } from '@testing-library/vue'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { createFlagClient } from './client.ts'
import type { FlagSource } from './types.ts'
import { FLAGS_INJECTION_KEY, NULL_FLAGS, flagsPlugin, useFlags } from './vue.ts'

const declarations = { 'checkout.express': { default: false } } as const

const Probe = defineComponent({
  setup() {
    const flags = useFlags<'checkout.express'>()
    return () => (flags.isOn('checkout.express') ? 'on' : 'off')
  },
})

describe('FLAGS_INJECTION_KEY', () => {
  it('is the plain string ADR 0005 requires', () => {
    expect(FLAGS_INJECTION_KEY as unknown as string).toBe('sentra:flags')
  })
})

describe('flagsPlugin', () => {
  it('provides the client it is given', () => {
    const source: FlagSource = { load: async () => ({ 'checkout.express': false }) }
    const client = createFlagClient({ declarations, source })
    render(Probe, { global: { plugins: [[flagsPlugin, client]] } })
    expect(screen.getByText('off')).toBeTruthy()
  })

  /**
   * This is the test that reaches back into Task 11: `createFlagClient`
   * stores its snapshot in a `shallowRef`, which notifies only when
   * `.value` is replaced, never when the object it holds is mutated in
   * place. The assertion is on rendered output — not on `client.isOn(...)`
   * read directly — because the point is proving a real component
   * re-renders, which a direct read of `isOn` cannot prove.
   *
   * Inverted-run check performed by hand while writing this test: with the
   * source's returned value left at `false` (never flipped) the assertion
   * `screen.getByText('on')` failed as expected, then passed once the
   * flip below was restored — confirming this test does not pass
   * regardless of whether the value actually changes.
   */
  it('re-renders a mounted component when a refresh flips the flag', async () => {
    let value = false
    const source: FlagSource = { load: async () => ({ 'checkout.express': value }) }
    const client = createFlagClient({ declarations, source })
    render(Probe, { global: { plugins: [[flagsPlugin, client]] } })
    expect(screen.getByText('off')).toBeTruthy()

    value = true
    await client.refresh()
    await nextTick()

    expect(screen.getByText('on')).toBeTruthy()
  })
})

describe('useFlags without an install', () => {
  it('resolves NULL_FLAGS and renders the off state', () => {
    render(Probe)
    expect(screen.getByText('off')).toBeTruthy()
  })

  it('does not throw', () => {
    expect(() => render(Probe)).not.toThrow()
  })
})

describe('NULL_FLAGS', () => {
  it('is ready immediately, with no source to wait for', () => {
    expect(NULL_FLAGS.ready.value).toBe(true)
  })

  it('isOn returns false for any key', () => {
    expect(NULL_FLAGS.isOn('anything')).toBe(false)
  })

  it('refresh resolves without doing anything', async () => {
    await expect(NULL_FLAGS.refresh()).resolves.toBeUndefined()
  })
})
