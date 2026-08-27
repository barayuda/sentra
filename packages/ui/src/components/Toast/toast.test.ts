import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import ToastHost from './ToastHost.vue'
import { toastPlugin, useToast } from './plugin.ts'
import { createToastService } from './service.ts'

describe('createToastService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a toast and returns its id', () => {
    const service = createToastService()
    const id = service.show({ title: 'Saved' })
    expect(service.toasts.value).toHaveLength(1)
    expect(service.toasts.value[0]?.id).toBe(id)
  })

  it('applies defaults: info variant, 5000ms duration', () => {
    const service = createToastService()
    service.show({ title: 'Saved' })
    expect(service.toasts.value[0]?.variant).toBe('info')
    expect(service.toasts.value[0]?.durationMs).toBe(5000)
  })

  it('auto-dismisses after the duration', () => {
    const service = createToastService()
    service.show({ title: 'Saved', durationMs: 1000 })
    vi.advanceTimersByTime(999)
    expect(service.toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(service.toasts.value).toHaveLength(0)
  })

  it('keeps a zero-duration toast until dismissed explicitly', () => {
    const service = createToastService()
    const id = service.show({ title: 'Sticky', durationMs: 0 })
    vi.advanceTimersByTime(60_000)
    expect(service.toasts.value).toHaveLength(1)
    service.dismiss(id)
    expect(service.toasts.value).toHaveLength(0)
  })

  it('dismissing an unknown id is a no-op', () => {
    const service = createToastService()
    service.show({ title: 'Saved' })
    service.dismiss(999)
    expect(service.toasts.value).toHaveLength(1)
  })
})

describe('toastPlugin + useToast', () => {
  it('provides a service through app.use', () => {
    let captured: unknown
    const Probe = defineComponent({
      setup() {
        captured = useToast()
        return () => h('div')
      },
    })
    const app = createApp(Probe)
    app.use(toastPlugin)
    app.mount(document.createElement('div'))
    expect(captured).toHaveProperty('show')
    app.unmount()
  })

  it('throws an instructive error when the plugin is not installed', () => {
    const Probe = defineComponent({
      setup() {
        useToast()
        return () => h('div')
      },
    })
    const app = createApp(Probe)
    expect(() => app.mount(document.createElement('div'))).toThrow(/app\.use\(toastPlugin\)/)
  })
})

describe('ToastHost', () => {
  it('renders a danger toast with role alert and others with role status', async () => {
    const service = createToastService()
    service.show({ title: 'Went wrong', variant: 'danger', durationMs: 0 })
    service.show({ title: 'Saved', variant: 'success', durationMs: 0 })
    render(ToastHost, { global: { provide: { 'sentra:toast': service } } })
    expect(screen.getByRole('alert').textContent).toContain('Went wrong')
    expect(screen.getByRole('status').textContent).toContain('Saved')
  })

  it('dismisses a toast from its close button', async () => {
    const service = createToastService()
    service.show({ title: 'Saved', durationMs: 0 })
    render(ToastHost, { global: { provide: { 'sentra:toast': service } } })
    const { fireEvent } = await import('@testing-library/vue')
    await fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(service.toasts.value).toHaveLength(0)
  })
})
