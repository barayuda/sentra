import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Input from './Input.vue'

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  args: { label: 'Email address', size: 'md' },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}

export const WithHint: Story = { args: { hint: 'We never share this address.' } }

export const WithError: Story = { args: { error: 'Enter a valid email address.' } }

export const Required: Story = { args: { required: true } }

export const Disabled: Story = { args: { disabled: true, modelValue: 'locked@example.test' } }

export const Password: Story = { args: { label: 'Password', type: 'password' } }
