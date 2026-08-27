import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import Combobox from './Combobox.vue'

const countries = [
  { value: 'id', label: 'Indonesia' },
  { value: 'sg', label: 'Singapore' },
  { value: 'my', label: 'Malaysia' },
  { value: 'th', label: 'Thailand' },
]

/** ARIA 1.2 combobox: focus stays in the input; arrows drive the listbox. */
const meta: Meta<typeof Combobox> = {
  title: 'Forms/Combobox',
  component: Combobox,
  args: { label: 'Country' },
}

export default meta
type Story = StoryObj<typeof Combobox>

export const Static: Story = { args: { options: countries } }

/** Async source resolving after a visible delay — the loading state story. */
export const AsyncLoading: Story = {
  args: {
    loadOptions: (query: string) =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve(countries.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))),
          1500,
        ),
      ),
  },
}

/** No matches — the empty state story. */
export const Empty: Story = { args: { options: [], placeholder: 'Type anything' } }

/** Failing source — the error state story. */
export const LoadError: Story = {
  args: { loadOptions: () => Promise.reject(new Error('network down')) },
}

export const Disabled: Story = { args: { options: countries, disabled: true } }

export const KeyboardSelection: Story = {
  args: { options: countries },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('combobox')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    await expect((input as HTMLInputElement).value).toBe('Singapore')
    await expect(input.getAttribute('aria-expanded')).toBe('false')
  },
}
