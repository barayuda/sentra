import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import Button from '../Button/Button.vue'
import Dialog from './Dialog.vue'

/**
 * Modal dialog: focus trap, scroll lock, Escape/overlay dismissal, SSR-safe
 * teleport. Open the story canvas and use Tab — focus cannot leave the panel.
 */
const meta: Meta<typeof Dialog> = {
  title: 'Overlays/Dialog',
  component: Dialog,
  args: { title: 'Remove product?', description: 'This action cannot be undone.' },
}

export default meta
type Story = StoryObj<typeof Dialog>

export const Interactive: Story = {
  render: (args) => ({
    components: { Dialog, Button },
    setup() {
      const open = ref(false)
      return { args, open }
    },
    template: `
      <Button @click="open = true">Open dialog</Button>
      <Dialog v-bind="args" v-model="open">
        <p>The product is removed from the catalogue immediately.</p>
        <template #footer>
          <Button variant="ghost" @click="open = false">Cancel</Button>
          <Button variant="danger" @click="open = false">Remove</Button>
        </template>
      </Dialog>
    `,
  }),
}
