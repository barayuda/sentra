import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import RemoteUnavailable from './RemoteUnavailable.vue'

const meta: Meta<typeof RemoteUnavailable> = {
  title: 'Platform/RemoteUnavailable',
  component: RemoteUnavailable,
}
export default meta
type Story = StoryObj<typeof RemoteUnavailable>

/** What an operator sees when a remote's bundle cannot be fetched. */
export const NetworkFailure: Story = {
  args: { name: 'console', reason: 'Failed to fetch remoteEntry.js' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    /* role="alert" is the contract, not decoration: a remote going down
       mid-session must reach a screen reader without a focus change. */
    await expect(canvas.getByRole('alert')).toBeVisible()
    await expect(canvas.getByText(/still working/i)).toBeVisible()
  },
}

/** A remote that loaded but does not implement the current contract. */
export const ContractMismatch: Story = {
  args: { name: 'storefront', reason: 'remote loaded but does not export routes and register' },
}
