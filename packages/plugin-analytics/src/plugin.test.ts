import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { analyticsPlugin, useAnalytics } from './plugin.ts'

const schema = { cta_click: ['id'] } as const

describe('analyticsPlugin', () => {
  it('provides a working client through app.use', () => {
    const send = vi.fn()
    let client!: ReturnType<typeof useAnalytics>
    const Probe = defineComponent({
      setup() {
        client = useAnalytics()
        return () => h('div')
      },
    })
    const app = createApp(Probe)
    app.use(analyticsPlugin, { schema, transport: { send } })
    app.mount(document.createElement('div'))
    client.track('cta_click', { id: 'hero' })
    expect(send).toHaveBeenCalledOnce()
    app.unmount()
  })

  it('throws an instructive error when not installed', () => {
    const Probe = defineComponent({
      setup() {
        useAnalytics()
        return () => h('div')
      },
    })
    expect(() => createApp(Probe).mount(document.createElement('div'))).toThrow(
      /app\.use\(analyticsPlugin/,
    )
  })
})
