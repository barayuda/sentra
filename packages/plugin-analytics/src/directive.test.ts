import { render, screen, fireEvent } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, type ObjectDirective } from 'vue'
import { createTrackDirective, type TrackBinding } from './directive.ts'
import { analyticsPlugin } from './plugin.ts'

/**
 * `createTrackDirective` returns `Directive<HTMLElement, TrackBinding>`, a
 * union that also admits a bare `FunctionDirective`. The tests below exercise
 * the lifecycle hooks directly, which only the object form has — this narrows
 * the return type to match what the implementation actually produces.
 */
function asObjectDirective(
  client: Parameters<typeof createTrackDirective>[0],
): ObjectDirective<HTMLElement, TrackBinding> {
  return createTrackDirective(client) as ObjectDirective<HTMLElement, TrackBinding>
}

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

  it('tracks the updated binding after a reactive change', () => {
    const events: string[] = []
    const client = { track: (name: string) => events.push(name), flush: () => {} }
    const directive = asObjectDirective(client)
    const el = document.createElement('button')
    const binding = { value: { name: 'first_event' }, arg: undefined } as never
    directive.mounted?.(el, binding, null as never, null as never)
    const nextBinding = { value: { name: 'second_event' }, arg: undefined } as never
    directive.updated?.(el, nextBinding, null as never, null as never)
    el.dispatchEvent(new Event('click'))
    expect(events).toEqual(['second_event'])
  })

  it('rebinds the listener when the event argument changes', () => {
    const events: string[] = []
    const client = { track: (name: string) => events.push(name), flush: () => {} }
    const directive = asObjectDirective(client)
    const el = document.createElement('button')
    directive.mounted?.(
      el,
      { value: { name: 'e' }, arg: 'click' } as never,
      null as never,
      null as never,
    )
    directive.updated?.(
      el,
      { value: { name: 'e' }, arg: 'submit' } as never,
      null as never,
      null as never,
    )
    el.dispatchEvent(new Event('click'))
    expect(events).toEqual([])
    el.dispatchEvent(new Event('submit'))
    expect(events).toEqual(['e'])
  })
})
