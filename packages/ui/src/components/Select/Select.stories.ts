import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Select from './Select.vue'

const OPTIONS = [
  { value: 'id', label: 'Indonesia' },
  { value: 'sg', label: 'Singapore' },
  { value: 'my', label: 'Malaysia', disabled: true },
]

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
  args: { label: 'Country', options: OPTIONS, size: 'md' },
}

export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {}

export const WithPlaceholder: Story = { args: { placeholder: 'Choose a country' } }

export const WithError: Story = { args: { error: 'Select a country to continue.' } }

export const Preselected: Story = { args: { modelValue: 'sg' } }

/** Documents that an empty option list renders without error. */
export const EmptyOptions: Story = { args: { options: [], placeholder: 'None available' } }
