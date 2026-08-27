import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Checkbox from './Checkbox.vue'

const meta: Meta<typeof Checkbox> = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
  args: { label: 'Accept the terms of service' },
}

export default meta
type Story = StoryObj<typeof Checkbox>

export const Unchecked: Story = {}

export const Checked: Story = { args: { modelValue: true } }

/** The mixed state, applied via the DOM property — see Task 9. */
export const Indeterminate: Story = { args: { label: 'Select all', indeterminate: true } }

export const WithDescription: Story = {
  args: { label: 'Marketing email', description: 'Roughly one message a month.' },
}

export const Disabled: Story = { args: { disabled: true } }
