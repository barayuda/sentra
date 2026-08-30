import { render, screen, fireEvent } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import Dialog from './Dialog.vue'

const baseProps = { modelValue: true, title: 'Confirm removal' }

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    render(Dialog, { props: { ...baseProps, modelValue: false } })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders an aria-modal dialog labelled by its title when open', async () => {
    render(Dialog, { props: baseProps })
    await nextTick()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Confirm removal')
  })

  it('wires the description through aria-describedby when provided', async () => {
    render(Dialog, { props: { ...baseProps, description: 'This cannot be undone.' } })
    await nextTick()
    const dialog = screen.getByRole('dialog')
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      'This cannot be undone.',
    )
  })

  it('omits aria-describedby without a description', async () => {
    render(Dialog, { props: baseProps })
    await nextTick()
    expect(screen.getByRole('dialog').hasAttribute('aria-describedby')).toBe(false)
  })

  it('renders body and footer slots', async () => {
    render(Dialog, {
      props: baseProps,
      slots: { default: 'Body content', footer: '<button>Confirm</button>' },
    })
    await nextTick()
    expect(screen.getByText('Body content')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy()
  })

  it('emits update:modelValue false when the overlay is clicked', async () => {
    const { emitted } = render(Dialog, { props: baseProps })
    await nextTick()
    await fireEvent.click(screen.getByTestId('dialog-overlay'))
    expect(emitted('update:modelValue')).toEqual([[false]])
  })

  it('does not close when the panel itself is clicked', async () => {
    const { emitted } = render(Dialog, {
      props: baseProps,
      slots: { default: 'Body content' },
    })
    await nextTick()
    await fireEvent.click(screen.getByText('Body content'))
    expect(emitted('update:modelValue')).toBeUndefined()
  })

  it('locks body scroll while open and releases it on close', async () => {
    const { rerender } = render(Dialog, { props: baseProps })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')
    await rerender({ ...baseProps, modelValue: false })
    await nextTick()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('moves focus into the dialog when it opens', async () => {
    render(Dialog, {
      props: baseProps,
      slots: { footer: '<button>Confirm</button>' },
    })
    await nextTick()
    await nextTick()
    const dialog = screen.getByRole('dialog')
    // The fallback focus call in Dialog.vue is conditional on containment,
    // so either focus-trap's own initial-focus target (a real tabbable
    // descendant, when present) or the panel fallback itself satisfies
    // this broader containment check — it no longer requires (and cannot
    // reward) an unconditional override of a real tabbable target.
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('layers the overlay and panel from z-index tokens rather than literals', async () => {
    render(Dialog, { props: { modelValue: true, title: 'Layered' } })
    await nextTick()
    const panel = screen.getByRole('dialog')
    expect(panel.className).toContain('z-[var(--z-index-modal)]')
    expect(panel.parentElement?.className).toContain('z-[var(--z-index-overlay)]')
  })

  describe('placement', () => {
    it('centres the panel by default', async () => {
      render(Dialog, { props: baseProps })
      await nextTick()
      const panel = screen.getByRole('dialog')
      expect(panel.parentElement?.className).toContain('items-center')
      expect(panel.parentElement?.className).toContain('justify-center')
      expect(panel.className).toContain('rounded-lg')
      expect(panel.className).not.toContain('h-full')
    })

    it('anchors the panel to the inline end as a full-height drawer', async () => {
      render(Dialog, { props: { ...baseProps, placement: 'end' } })
      await nextTick()
      const panel = screen.getByRole('dialog')
      expect(panel.parentElement?.className).toContain('justify-end')
      expect(panel.parentElement?.className).toContain('items-stretch')
      /* Square against the viewport edge, and full height — the two things
         that make it read as a drawer rather than an off-centre modal. */
      expect(panel.className).toContain('h-full')
      expect(panel.className).not.toContain('rounded-lg')
    })

    it('keeps the modal contract when placed as a drawer', async () => {
      /* Placement is presentation only. A drawer that quietly dropped the
         focus trap, the scroll lock, or the ARIA wiring would defeat the
         reason this component is reused instead of hand-rolled — so assert
         the contract on the branch that changes, not only on the default. */
      render(Dialog, {
        props: { ...baseProps, placement: 'end' },
        slots: { footer: '<button>Confirm</button>' },
      })
      await nextTick()
      await nextTick()
      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('aria-modal')).toBe('true')
      const labelledBy = dialog.getAttribute('aria-labelledby')
      expect(document.getElementById(labelledBy as string)?.textContent).toBe('Confirm removal')
      expect(document.body.style.overflow).toBe('hidden')
      expect(dialog.contains(document.activeElement)).toBe(true)
    })

    it('scrolls the body and pins the footer when placed as a drawer', async () => {
      /* The reason overflow lives on the body rather than the panel: with a
         panel-level scroll, a long list pushes the footer past the bottom of
         the viewport. Assert the split — panel is a column that does not
         scroll, body scrolls, footer sits outside the scrolling region. */
      render(Dialog, {
        props: { ...baseProps, placement: 'end' },
        slots: { default: 'Body content', footer: '<button>Confirm</button>' },
      })
      await nextTick()
      const panel = screen.getByRole('dialog')
      const body = screen.getByTestId('dialog-body')
      const footer = screen.getByTestId('dialog-footer')

      expect(panel.className).toContain('flex-col')
      expect(panel.className).not.toContain('overflow-y-auto')
      expect(body.className).toContain('overflow-y-auto')
      expect(body.className).toContain('flex-1')
      /* Without min-h-0 a flex child cannot shrink below its content, so the
         column outgrows the panel and the overflow above never engages. */
      expect(body.className).toContain('min-h-0')
      expect(body.contains(footer)).toBe(false)
      expect(footer.textContent).toContain('Confirm')
    })

    it('keeps the centred placement unscrolled with a trailing-aligned footer', async () => {
      render(Dialog, {
        props: baseProps,
        slots: { default: 'Body content', footer: '<button>Confirm</button>' },
      })
      await nextTick()
      const body = screen.getByTestId('dialog-body')
      /* A modal is sized by its content: nothing to pin, nothing to scroll. */
      expect(body.className).not.toContain('overflow-y-auto')
      expect(screen.getByTestId('dialog-footer').className).toContain('justify-end')
    })

    it('closes on overlay click when placed as a drawer', async () => {
      const { emitted } = render(Dialog, { props: { ...baseProps, placement: 'end' } })
      await nextTick()
      await fireEvent.click(screen.getByTestId('dialog-overlay'))
      expect(emitted('update:modelValue')).toEqual([[false]])
    })
  })
})
