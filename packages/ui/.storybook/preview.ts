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
     *
     * The Vue3 decorator contract requires returning a component definition
     * that renders the wrapped story via the `<story/>` placeholder — merely
     * returning the `story` render function left it uninvoked, so every
     * story's actual markup was replaced by the function's own source dump
     * (e.g. `[object Object]` or a minified arrow function) in the DOM. That
     * silently broke every play function and every a11y scan: both were
     * inspecting decorator debris, not real component output.
     */
    (_story: unknown, context: { globals: { theme: string; density: string } }) => {
      document.documentElement.setAttribute('data-theme', context.globals.theme)
      document.documentElement.setAttribute('data-density', context.globals.density)
      /*
       * Paint the canvas from the same tokens the story uses. Storybook's own
       * preview background belongs to the manager theme, not to this document,
       * so without these two lines the canvas stayed the manager's colour while
       * the components on it switched — a dark-mode story rendered on white,
       * which is not a state any application can produce and so documents a
       * component nobody will ever see.
       *
       * These are `var()` references, not resolved values: the attribute above
       * decides what they mean, so one assignment covers both themes.
       */
      document.body.style.background = 'var(--color-neutral-50)'
      document.body.style.color = 'var(--color-neutral-900)'
      return { template: '<story/>' }
    },
  ],
}

export default preview
