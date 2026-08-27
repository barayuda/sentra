import { render, screen, fireEvent } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { analyticsPlugin } from './plugin.ts'

const schema = { cta_click: ['id'], form_submit: [] } as const

function renderWithPlugin(template: string) {
  const send = vi.fn()
  render(defineComponent({ template }), {
    global: { plugins: [[analyticsPlugin, { schema, transport: { send } }]] },
  })
  return send
}

describe('v-track', () => {
  it('tracks on click by default', async () => {
    const send = renderWithPlugin(
      `<button v-track="{ name: 'cta_click', props: { id: 'hero' } }">Buy</button>`,
    )
    await fireEvent.click(screen.getByRole('button'))
    expect(send).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'cta_click', props: { id: 'hero' } }),
    ])
  })

  it('tracks the DOM event named by the directive argument', async () => {
    const send = renderWithPlugin(
      `<form v-track:submit="{ name: 'form_submit' }"><button>Go</button></form>`,
    )
    await fireEvent.submit(screen.getByRole('button').closest('form') as HTMLFormElement)
    expect(send).toHaveBeenCalledWith([expect.objectContaining({ name: 'form_submit' })])
  })

  it('does not fire after unmount', async () => {
    const send = vi.fn()
    const { unmount } = render(
      defineComponent({
        template: `<button v-track="{ name: 'cta_click' }">Buy</button>`,
      }),
      { global: { plugins: [[analyticsPlugin, { schema, transport: { send } }]] } },
    )
    const el = screen.getByRole('button')
    unmount()
    el.dispatchEvent(new Event('click'))
    expect(send).not.toHaveBeenCalled()
  })
})
