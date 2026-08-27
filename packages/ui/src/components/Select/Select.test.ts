import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import Select from './Select.vue'

const OPTIONS = [
  { value: 'id', label: 'Indonesia' },
  { value: 'sg', label: 'Singapore' },
  { value: 'my', label: 'Malaysia', disabled: true },
]

describe('Select', () => {
  it('associates the label with the control', () => {
    render(Select, { props: { label: 'Country', options: OPTIONS } })
    expect(screen.getByLabelText('Country')).toBeTruthy()
  })

  it('renders one option per entry', () => {
    render(Select, { props: { label: 'Country', options: OPTIONS } })
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('renders a placeholder option when a placeholder is supplied', () => {
    render(Select, {
      props: { label: 'Country', options: OPTIONS, placeholder: 'Choose one' },
    })
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getByRole('option', { name: 'Choose one' })).toBeTruthy()
  })

  it('marks individually disabled options as disabled', () => {
    render(Select, { props: { label: 'Country', options: OPTIONS } })
    expect((screen.getByRole('option', { name: 'Malaysia' }) as HTMLOptionElement).disabled).toBe(
      true,
    )
  })

  it('reflects modelValue as the selected option', () => {
    render(Select, { props: { label: 'Country', options: OPTIONS, modelValue: 'sg' } })
    expect((screen.getByLabelText('Country') as HTMLSelectElement).value).toBe('sg')
  })

  it('emits update:modelValue on change so v-model works', async () => {
    const { emitted } = render(Select, { props: { label: 'Country', options: OPTIONS } })
    await fireEvent.update(screen.getByLabelText('Country'), 'sg')
    expect(emitted()['update:modelValue']).toEqual([['sg']])
  })

  it('marks the control invalid and announces the error when one is present', () => {
    render(Select, { props: { label: 'Country', options: OPTIONS, error: 'Pick a country' } })
    expect(screen.getByLabelText('Country').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toContain('Pick a country')
  })

  it('renders no options for an empty list without crashing', () => {
    render(Select, { props: { label: 'Country', options: [] } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
