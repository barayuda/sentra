import type { Meta, StoryObj } from '@storybook/vue3-vite'
import ProductCard from './ProductCard.vue'

/** Domain composition: image, badge, Money price, slots. */
const meta: Meta<typeof ProductCard> = {
  title: 'Domain/ProductCard',
  component: ProductCard,
  args: {
    title: 'Aeropress Go',
    price: { amount: '49.00', currency: 'USD' },
    imageAlt: 'Aeropress Go brewer',
  },
}

export default meta
type Story = StoryObj<typeof ProductCard>

export const Default: Story = {}
export const WithBadge: Story = { args: { badge: 'New' } }

/** Skeleton — the loading state story. */
export const Loading: Story = { args: { loading: true } }
