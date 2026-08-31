import { createI18n, i18nPlugin } from '@sentra/i18n'
import { render, screen, fireEvent } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { uiMessages } from '../../i18n/index.ts'
import Combobox from './Combobox.vue'

const options = [
  { value: 'id', label: 'Indonesia' },
  { value: 'sg', label: 'Singapore' },
  { value: 'my', label: 'Malaysia' },
]

/** A promise whose resolution the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('Combobox', () => {
  it('renders a labelled combobox input, closed by default', () => {
    render(Combobox, { props: { label: 'Country', options } })
    const input = screen.getByRole('combobox', { name: 'Country' })
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens on ArrowDown and exposes options', async () => {
    render(Combobox, { props: { label: 'Country', options } })
    await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('filters static options as the user types', async () => {
    render(Combobox, { props: { label: 'Country', options } })
    await fireEvent.update(screen.getByRole('combobox'), 'sing')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option', { name: 'Singapore' })).toBeTruthy()
  })

  it('tracks the active option with aria-activedescendant', async () => {
    render(Combobox, { props: { label: 'Country', options } })
    const input = screen.getByRole('combobox')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    const active = input.getAttribute('aria-activedescendant')
    expect(document.getElementById(active as string)?.textContent).toContain('Singapore')
  })

  it('wraps with Home and End', async () => {
    render(Combobox, { props: { label: 'Country', options } })
    const input = screen.getByRole('combobox')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'End' })
    const active = input.getAttribute('aria-activedescendant')
    expect(document.getElementById(active as string)?.textContent).toContain('Malaysia')
    await fireEvent.keyDown(input, { key: 'Home' })
    const first = input.getAttribute('aria-activedescendant')
    expect(document.getElementById(first as string)?.textContent).toContain('Indonesia')
  })

  it('selects the active option with Enter: emits, closes, shows the label', async () => {
    const { emitted } = render(Combobox, { props: { label: 'Country', options } })
    const input = screen.getByRole('combobox')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(emitted('update:modelValue')).toEqual([['sg']])
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect((input as HTMLInputElement).value).toBe('Singapore')
  })

  it('marks the selected option with aria-selected on reopen', async () => {
    render(Combobox, { props: { label: 'Country', options, modelValue: 'sg' } })
    await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: 'Singapore' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })

  it('closes on Escape without selecting', async () => {
    const { emitted } = render(Combobox, { props: { label: 'Country', options } })
    const input = screen.getByRole('combobox')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(emitted('update:modelValue')).toBeUndefined()
  })

  it('selects an option on click', async () => {
    const { emitted } = render(Combobox, { props: { label: 'Country', options } })
    await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    await fireEvent.click(screen.getByRole('option', { name: 'Malaysia' }))
    expect(emitted('update:modelValue')).toEqual([['my']])
  })

  it('shows a loading state while async options resolve', async () => {
    const { promise, resolve } = deferred<typeof options>()
    render(Combobox, { props: { label: 'Country', loadOptions: () => promise } })
    await fireEvent.update(screen.getByRole('combobox'), 'in')
    expect(screen.getByRole('listbox').getAttribute('aria-busy')).toBe('true')
    resolve(options)
    await new Promise((r) => setTimeout(r))
    expect(screen.getByRole('listbox').hasAttribute('aria-busy')).toBe(false)
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('ignores an out-of-order async response', async () => {
    const first = deferred<typeof options>()
    const second = deferred<typeof options>()
    const responses = [first.promise, second.promise]
    let call = 0
    render(Combobox, {
      props: { label: 'Country', loadOptions: () => responses[call++] as Promise<typeof options> },
    })
    const input = screen.getByRole('combobox')
    await fireEvent.update(input, 'i')
    await fireEvent.update(input, 'in')
    second.resolve([{ value: 'id', label: 'Indonesia' }])
    await new Promise((r) => setTimeout(r))
    first.resolve(options)
    await new Promise((r) => setTimeout(r))
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('renders a load failure as an alert', async () => {
    render(Combobox, {
      props: { label: 'Country', loadOptions: () => Promise.reject(new Error('boom')) },
    })
    await fireEvent.update(screen.getByRole('combobox'), 'in')
    await new Promise((r) => setTimeout(r))
    expect(screen.getByRole('alert').textContent).toMatch(/could not load/i)
  })

  it('does not open when disabled', async () => {
    render(Combobox, { props: { label: 'Country', options, disabled: true } })
    await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('false')
  })

  it('opens on ArrowUp from closed and activates the last option', async () => {
    const { getByRole } = render(Combobox, { props: { label: 'Country', options } })
    const input = getByRole('combobox')
    await fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.getAttribute('aria-expanded')).toBe('true')
    const items = getByRole('listbox').querySelectorAll('[role="option"]')
    const last = items[items.length - 1]
    expect(input.getAttribute('aria-activedescendant')).toBe(last?.id)
  })

  it('grows the listbox out of the input it belongs to', async () => {
    render(Combobox, { props: { label: 'Country', options } })
    await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
    const listbox = screen.getByRole('listbox')
    /* `origin-top` is the part that makes this read as the input opening
       rather than a panel materialising: scaling from the element's own
       centre makes it appear to drift upward as it grows. */
    expect(listbox.className).toContain('origin-top')
    expect(listbox.className).toContain('scale-95')
    expect(listbox.className).toContain('duration-[var(--duration-fast)]')
  })

  it('keeps the listbox reachable by role while it animates open', async () => {
    /* The transition wraps the listbox, so it must not have displaced the
       `role="listbox"` element that `aria-controls` points at — a popover
       that animates but is no longer the referenced element is a worse
       component than one that does not animate at all. */
    render(Combobox, { props: { label: 'Country', options } })
    const input = screen.getByRole('combobox')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByRole('listbox').id).toBe(input.getAttribute('aria-controls'))
  })

  it('renders the translated loading state', async () => {
    const { promise } = deferred<typeof options>()
    const i18n = createI18n({ locale: 'id', fallbackLocale: 'en', messages: uiMessages })
    render(Combobox, {
      props: { label: 'Country', loadOptions: () => promise },
      global: { plugins: [[i18nPlugin, i18n]] },
    })
    await fireEvent.update(screen.getByRole('combobox'), 'in')
    expect(screen.getByText('Memuat…')).toBeTruthy()
  })
})
