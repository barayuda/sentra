import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Money from './Money.vue'

/** `Intl.NumberFormat` does the work; the stories prove the locale rules. */
const meta: Meta<typeof Money> = { title: 'Domain/Money', component: Money }

export default meta
type Story = StoryObj<typeof Money>

export const USDollars: Story = { args: { amount: '1250.50', currency: 'USD', locale: 'en-US' } }
export const Rupiah: Story = { args: { amount: 250000, currency: 'IDR', locale: 'id-ID' } }
export const UnparseableAmount: Story = {
  args: { amount: 'oops', currency: 'USD', locale: 'en-US' },
}
