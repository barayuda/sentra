import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import Checkbox from './Checkbox.vue'

describe('Checkbox', () => {
  it('associates the label with the control', () => {
    render(Checkbox, { props: { label: 'Accept terms' } })
    expect(screen.getByLabelText('Accept terms')).toBeTruthy()
  })

  it('is unchecked by default', () => {
    render(Checkbox, { props: { label: 'Accept terms' } })
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('reflects modelValue as the checked state', () => {
    render(Checkbox, { props: { label: 'Accept terms', modelValue: true } })
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })

  it('emits the new boolean when toggled', async () => {
    const { emitted } = render(Checkbox, { props: { label: 'Accept terms' } })
    await fireEvent.click(screen.getByRole('checkbox'))
    expect(emitted()['update:modelValue']).toEqual([[true]])
  })

  it('emits false when toggled off', async () => {
    const { emitted } = render(Checkbox, {
      props: { label: 'Accept terms', modelValue: true },
    })
    await fireEvent.click(screen.getByRole('checkbox'))
    expect(emitted()['update:modelValue']).toEqual([[false]])
  })

  it('sets the indeterminate DOM property, which no attribute can express', () => {
    render(Checkbox, { props: { label: 'Select all', indeterminate: true } })
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true)
  })

  it('leaves indeterminate false by default', () => {
    render(Checkbox, { props: { label: 'Select all' } })
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(false)
  })

  it('renders a description and links it via aria-describedby', () => {
    render(Checkbox, {
      props: { label: 'Marketing email', description: 'Roughly one message a month' },
    })
    const description = screen.getByText('Roughly one message a month')
    expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toBe(description.id)
  })

  it('disables the control when requested', () => {
    render(Checkbox, { props: { label: 'Accept terms', disabled: true } })
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
  })
})
