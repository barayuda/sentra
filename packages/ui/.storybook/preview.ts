import type { Preview } from '@storybook/vue3-vite'
import { setup } from '@storybook/vue3-vite'
import { toastPlugin } from '../src/index.ts'
import '../src/styles.css'

/**
 * Installs the toast plugin into Storybook's Vue app, exactly as an
 * application root would via `app.use(toastPlugin)` — required for the
 * Toast stories' `useToast()` call to resolve.
 */
setup((app) => {
  app.use(toastPlugin)
})

/**
 * Global Storybook parameters.
 *
 * The stylesheet is imported here rather than per-story so every story renders
 * with tokens applied — a story that silently lacked them would document the
 * wrong component.
 */
const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    /**
     * Fail the story on any accessibility violation rather than reporting it
     * passively. A warning nobody reads is not a gate.
     */
    a11y: { test: 'error' },
  },
  globalTypes: {
    theme: {
      description: 'Colour scheme',
      toolbar: { title: 'Theme', items: ['light', 'dark'], dynamicTitle: true },
    },
    density: {
      description: 'Spacing density',
      toolbar: { title: 'Density', items: ['comfortable', 'compact'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light', density: 'comfortable' },
  decorators: [
    /**
     * Applies the mode attributes to the document root, matching how a real
     * application opts in — the token override blocks do the rest.
     */
    (story: unknown, context: { globals: { theme: string; density: string } }) => {
      document.documentElement.setAttribute('data-theme', context.globals.theme)
      document.documentElement.setAttribute('data-density', context.globals.density)
      return story
    },
  ],
}

export default preview
