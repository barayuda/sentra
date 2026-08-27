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
    // Authorized substitution (brief, Task 3 Step 4 note): happy-dom's
    // focus-trap integration cannot reliably compute descendant tabbables,
    // so this asserts the panel itself (tabindex="-1", the fallbackFocus
    // target) received focus rather than `dialog.contains(activeElement)`.
    expect(document.activeElement).toBe(dialog)
  })
})
