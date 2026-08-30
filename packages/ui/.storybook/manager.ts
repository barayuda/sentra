import { flattenTokens, tokens } from '@sentra/tokens'
import { addons } from 'storybook/manager-api'
import { create, themes } from 'storybook/theming'

/**
 * Storybook manager (chrome) theme for `@sentra/ui`.
 *
 * This file styles the shell around the stories — sidebar, toolbar, brand —
 * which is a separate document from the preview iframe. `preview.ts` imports
 * `styles.css`; the manager never sees it, so the chrome cannot pick up tokens
 * through CSS and has to be handed the values directly.
 *
 * They are read from the token source rather than retyped as hex literals for
 * the same reason components are: a brand colour changed in one place should
 * not leave the documentation of that brand behind, still showing the old one.
 */
const palette = new Map(flattenTokens(tokens).map(({ name, value }) => [name, value]))

/**
 * Reads a token by its generated custom-property name.
 *
 * Throws on an unknown name rather than falling back to a default. A silent
 * fallback here would render a plausible-looking Storybook themed in colours
 * that came from nowhere — the failure would be invisible precisely because
 * the result still looks fine.
 *
 * @param name - Full custom-property name, e.g. `--color-brand-600`.
 * @returns The token's value.
 */
function token(name: string): string {
  const value = palette.get(name)
  if (value === undefined) {
    throw new Error(`Storybook manager theme references a token that does not exist: ${name}`)
  }
  return value
}

/**
 * Converts a `rem` token to the plain pixel number Storybook's theme expects.
 *
 * The radius tokens are authored in `rem` because components scale with the
 * root font size; Storybook's theme API takes a unitless number and appends
 * `px` itself, so the conversion has to happen somewhere. Doing it here keeps
 * the token as the source and confines the 16px assumption to one line.
 *
 * @param name - Full custom-property name of a `rem`-valued token.
 * @returns The equivalent pixel count.
 */
function remToPx(name: string): number {
  return Number.parseFloat(token(name)) * 16
}

/**
 * Whether the operating system asks for a dark interface.
 *
 * Storybook's manager takes one theme object at configuration time and has no
 * mode switch of its own, so the choice is made once, here. The preview's
 * Theme toolbar is unrelated and still switches the *stories* independently —
 * which is the honest arrangement: the chrome follows the reader's machine,
 * the canvas follows what they are inspecting.
 */
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

addons.setConfig({
  theme: create({
    base: prefersDark ? 'dark' : 'light',
    ...(prefersDark ? themes.dark : themes.light),

    /*
     * `brandTitle` is rendered as HTML when no `brandImage` is set, which is
     * what lets the mark and the wordmark sit together in one link. Setting
     * `brandImage` instead would replace the title entirely and demote
     * "SENTRA" to alt text — present for a screen reader, invisible on screen.
     *
     * The wordmark inherits `color`, so it stays legible in both manager
     * themes without a second, differently-coloured asset to keep in sync.
     */
    brandTitle: `
      <span style="display:inline-flex;align-items:center;gap:0.5rem">
        <img src="/brand/sentra-mark.png" alt="" width="28" height="28" />
        <span style="font-weight:700;letter-spacing:0.08em">SENTRA</span>
      </span>
    `,
    brandUrl: 'https://github.com/barayuda/sentra',
    brandTarget: '_self',

    colorPrimary: token('--color-brand-600'),
    colorSecondary: token('--color-brand-600'),
    appBorderRadius: remToPx('--radius-md'),
    inputBorderRadius: remToPx('--radius-md'),
  }),
})
