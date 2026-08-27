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
}

export default config
