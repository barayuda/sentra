import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createSessionPlugin, useSession } from './session.ts'

const Probe = defineComponent({
  setup() {
    const session = useSession()
    return () => session.value?.displayName ?? 'signed out'
  },
})

describe('session', () => {
  it('exposes the initial session to a descendant', () => {
    const { plugin } = createSessionPlugin({ id: 'u1', displayName: 'Ops User', role: 'ops' })
    const wrapper = mount(Probe, { global: { plugins: [plugin] } })
    expect(wrapper.text()).toBe('Ops User')
  })

  it('re-renders descendants when the session ref changes', async () => {
    const { plugin, session } = createSessionPlugin(null)
    const wrapper = mount(Probe, { global: { plugins: [plugin] } })
    expect(wrapper.text()).toBe('signed out')

    session.value = { id: 'u2', displayName: 'Shopper', role: 'shopper' }
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('Shopper')
  })

  it('returns a null session rather than throwing when not installed', () => {
    const wrapper = mount(Probe)
    expect(wrapper.text()).toBe('signed out')
  })
})
