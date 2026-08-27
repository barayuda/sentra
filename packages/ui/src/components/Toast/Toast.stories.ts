import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import Button from '../Button/Button.vue'
import ToastHost from './ToastHost.vue'
import { useToast } from './plugin.ts'

/**
 * Imperative toasts installed via `app.use(toastPlugin)`. The demo component
 * calls `useToast()` exactly as an application would.
 */
const meta: Meta<typeof ToastHost> = {
  title: 'Feedback/Toast',
  component: ToastHost,
}

export default meta
type Story = StoryObj<typeof ToastHost>

export const Playground: Story = {
  render: () => ({
    components: { ToastHost, Button },
    setup() {
      const toast = useToast()
      return {
        info: () => toast.show({ title: 'Draft saved' }),
        success: () => toast.show({ title: 'Order placed', variant: 'success' }),
        danger: () =>
          toast.show({
            title: 'Payment failed',
            description: 'Card was declined.',
            variant: 'danger',
            durationMs: 0,
          }),
      }
    },
    template: `
      <div class="flex gap-2">
        <Button @click="info">Info</Button>
        <Button variant="secondary" @click="success">Success</Button>
        <Button variant="danger" @click="danger">Danger (sticky)</Button>
      </div>
      <ToastHost />
    `,
  }),
}

export const DangerAnnounces: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Danger (sticky)' }))
    const body = within(document.body)
    await expect((await body.findByRole('alert')).textContent).toContain('Payment failed')
  },
}
