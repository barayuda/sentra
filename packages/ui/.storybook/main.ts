import type { StorybookConfig } from '@storybook/vue3-vite'

/**
 * Storybook configuration for `@sentra/ui`.
 *
 * Stories are colocated with their components under `src/components/`, matching
 * the one-directory-per-component convention from Task 6, so a component and its
 * documentation move together.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  /**
   * Serves the repository's brand assets at `/brand`.
   *
   * The mark is kept at the repository root rather than copied in here because
   * the README renders the same file — a second copy would be a binary that
   * drifts silently, since nothing fails when two PNGs disagree. Reaching up
   * out of the package is the cost of that, and it fails loudly (Storybook
   * refuses to boot on a missing static dir) rather than quietly serving
   * nothing.
   */
  staticDirs: [{ from: '../../../docs/assets', to: '/brand' }],
  /**
   * Puts the mark in the browser tab. `manager.ts` can only style what
   * Storybook renders inside the page; the favicon is part of the surrounding
   * HTML and is reachable only from here.
   *
   * The tab's *title* is deliberately not set alongside it. Storybook rewrites
   * `document.title` on every navigation to name the selected story, so a
   * `<title>` tag added here is overwritten before anyone reads it — it would
   * be a line that looks like configuration and changes nothing.
   */
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/brand/sentra-mark.png" />
  `,
}

export default config
