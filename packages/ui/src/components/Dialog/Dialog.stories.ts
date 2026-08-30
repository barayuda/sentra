import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, waitForElementToBeRemoved, within } from 'storybook/test'
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

/**
 * The same component anchored to the inline end. Only the layout differs —
 * focus trap, scroll lock, Escape and overlay dismissal are shared with the
 * centred placement, which is the reason a drawer is a prop here rather than
 * a second component.
 *
 * The body is deliberately longer than the panel: the footer staying put
 * while the list scrolls under it is the behaviour worth seeing, and a story
 * with three lines of content would demonstrate nothing.
 */
export const Drawer: Story = {
  args: { title: 'Your cart', description: undefined, placement: 'end' },
  render: (args) => ({
    components: { Dialog, Button },
    setup() {
      const open = ref(false)
      const rows = Array.from({ length: 20 }, (_, i) => `Line item ${i + 1}`)
      return { args, open, rows }
    },
    template: `
      <Button @click="open = true">Open drawer</Button>
      <Dialog v-bind="args" v-model="open">
        <ul class="flex flex-col gap-4">
          <li v-for="row in rows" :key="row" class="text-sm text-neutral-700">{{ row }}</li>
        </ul>
        <template #footer>
          <Button @click="open = false">Checkout</Button>
          <Button variant="ghost" @click="open = false">Keep shopping</Button>
        </template>
      </Dialog>
    `,
  }),
}

export const DrawerTrapHoldsFocus: Story = {
  ...Drawer,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open drawer' }))
    const body = within(document.body)
    const dialog = await body.findByRole('dialog')
    /* The drawer must earn its modal semantics the same way the centred
       placement does; a placement that silently dropped them would still
       look correct in the canvas. */
    await expect(dialog.getAttribute('aria-modal')).toBe('true')
    await expect(dialog.className).toContain('h-full')

    /* The panel is found the moment it mounts, which is the moment it is
       still translated off the edge. Measuring then would measure the
       animation, not the layout — so wait for the enter to hand the panel
       over to its resting position first. */
    await waitFor(() => expect(dialog.className).not.toContain('translate-x-full'))

    /* Real layout, which is the one thing the unit tests cannot check: the
       body genuinely overflows, the panel itself does not, and the footer
       stays inside the panel's box while the list scrolls under it. In
       happy-dom every one of these numbers would be zero. */
    const dialogBody = dialog.querySelector('[data-testid="dialog-body"]') as HTMLElement
    const footer = dialog.querySelector('[data-testid="dialog-footer"]') as HTMLElement
    await expect(dialogBody.scrollHeight).toBeGreaterThan(dialogBody.clientHeight)
    await expect(dialog.scrollHeight).toBe(dialog.clientHeight)
    await expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      Math.ceil(dialog.getBoundingClientRect().bottom),
    )

    await userEvent.tab()
    await expect(dialog.contains(document.activeElement)).toBe(true)
    await userEvent.keyboard('{Escape}')
    /* Dismissal is animated, so the panel outlives the keystroke by the
       leave duration. A bare `queryByRole(...)` assertion here would be
       checking the DOM mid-transition and would fail in a real browser
       while passing in happy-dom, where nothing has a duration. */
    await waitForElementToBeRemoved(() => body.queryByRole('dialog'))
  },
}

export const TrapHoldsFocus: Story = {
  ...Interactive,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }))
    const body = within(document.body)
    const dialog = await body.findByRole('dialog')
    await expect(dialog.getAttribute('aria-modal')).toBe('true')
    await userEvent.tab()
    await expect(dialog.contains(document.activeElement)).toBe(true)
    await userEvent.keyboard('{Escape}')
    await waitForElementToBeRemoved(() => body.queryByRole('dialog'))
  },
}
