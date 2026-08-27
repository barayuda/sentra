import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Flat ESLint configuration for every Sentra workspace.
 *
 * Kept at the repository root rather than per-package so that one rule change
 * applies everywhere — a design system whose own packages disagree about lint
 * rules cannot credibly enforce standards on its consumers.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
    ],
  },

  ...tseslint.configs.recommended,
  ...eslintPluginVue.configs['flat/recommended'],

  {
    // Vue SFCs are parsed by vue-eslint-parser, which delegates <script lang="ts">
    // to the TypeScript parser. Without this the TS in every SFC is unparseable.
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      /**
       * Banning `v-html` is the lint-enforced half of the output-encoding control
       * in spec §10. Shopify's Storefront API returns merchant-authored HTML in
       * product descriptions; rendering it through `v-html` without sanitisation
       * is a stored-XSS path. When M3 genuinely needs to render that HTML, the
       * sanitisation boundary gets an explicit, reviewed `eslint-disable` with a
       * comment naming the sanitiser — which is exactly the review checkpoint
       * this rule exists to force.
       */
      'vue/no-v-html': 'error',

      /** Unused variables are a defect, not a style preference. */
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      /** Explicit `any` defeats the point of the strict tsconfig from Task 2. */
      '@typescript-eslint/no-explicit-any': 'error',

      /** Component names must be multi-word to avoid clashing with HTML elements. */
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    // Tests may reach for looser typing when constructing fixtures.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  /**
   * Must be last: disables every ESLint (including eslint-plugin-vue)
   * formatting rule that conflicts with Prettier. `format:check` (Prettier)
   * is the formatting gate; without this, eslint-plugin-vue's bundled
   * attribute-wrapping and self-closing rules fight Prettier's own printWidth
   * decisions, and `pnpm lint` / `pnpm format` flip-flop against each other
   * on every run instead of converging.
   */
  eslintConfigPrettier,
)
