import type { Preview } from '@storybook/vue3-vite'
import '../src/styles.css'

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
}

export default preview
