import type { CssVariable } from './flatten.ts'

/**
 * Custom property namespaces from which Tailwind 4 derives utility classes.
 *
 * A variable whose first name segment appears here belongs in `@theme`; everything else
 * is emitted to `:root` as a plain custom property. Getting this split wrong is silent:
 * a token in the wrong bucket still renders as valid CSS, it just fails to produce the
 * utility class you expected.
 *
 * Verified against the official "Theme variable namespaces" table at
 * https://tailwindcss.com/docs/theme (fetched 2026-08-27). The full table lists:
 * `--color-*`, `--font-*`, `--text-*`, `--font-weight-*`, `--tracking-*`, `--leading-*`,
 * `--tab-size-*`, `--breakpoint-*`, `--container-*`, `--spacing-*`, `--radius-*`,
 * `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`, `--blur-*`, `--perspective-*`,
 * `--zoom-*`, `--aspect-*`, `--ease-*`, and `--animate-*`.
 *
 * `color`, `font`, `spacing`, and `breakpoint` were confirmed against the Tailwind 4
 * documentation during planning. `text`, `radius`, `shadow`, `container`, `tracking`,
 * `leading`, `ease`, and `animate` were the remaining unverified entries and are now
 * confirmed present in the table above, so all twelve are kept. Namespaces from the
 * table that the Sentra token source does not currently produce values for
 * (`font-weight`, `tab-size`, `inset-shadow`, `drop-shadow`, `blur`, `perspective`,
 * `zoom`, `aspect`) are intentionally omitted here; add them if `tokens.ts` ever grows
 * a branch for them.
 *
 * Note that `duration` and `zIndex` are deliberately absent: Tailwind exposes motion
 * through `--ease-*` and `--animate-*`, and has no z-index namespace at all, so those
 * tokens correctly fall through to `:root`.
 */
const TAILWIND_THEME_NAMESPACES: ReadonlySet<string> = new Set([
  'color',
  'font',
  'text',
  'spacing',
  'radius',
  'shadow',
  'breakpoint',
  'container',
  'tracking',
  'leading',
  'ease',
  'animate',
])

/**
 * Extracts the leading namespace segment from a custom property name.
 *
 * @param name - A custom property name including its `--` prefix.
 * @returns The first hyphen-separated segment after the prefix.
 */
function namespaceOf(name: string): string {
  return name.slice(2).split('-')[0] ?? ''
}

/**
 * Renders one CSS block, or an empty string when there is nothing to render.
 *
 * @param selector - Block selector or at-rule, e.g. `':root'` or `'@theme'`.
 * @param variables - Variables to declare inside the block.
 * @returns The block text with a trailing newline, or `''` if `variables` is empty.
 */
function renderBlock(selector: string, variables: readonly CssVariable[]): string {
  if (variables.length === 0) return ''
  const declarations = variables.map((v) => `  ${v.name}: ${v.value};`).join('\n')
  return `${selector} {\n${declarations}\n}\n`
}

/**
 * Renders CSS custom properties, routing each to `@theme` or `:root`.
 *
 * Tailwind-recognised namespaces go to `@theme` so they generate utility
 * classes; the remainder go to `:root` so they stay usable via `var()`.
 * Empty blocks are omitted so the output has no dead declarations.
 *
 * @param variables - Flattened variables, typically from `flattenTokens`.
 * @returns CSS text, `@theme` block first. Empty string when given no variables.
 *
 * @example
 * ```ts
 * renderCss([{ name: '--color-brand-500', value: '#0ea5e9' }])
 * // => '@theme {\n  --color-brand-500: #0ea5e9;\n}\n'
 * ```
 */
export function renderCss(variables: readonly CssVariable[]): string {
  const theme: CssVariable[] = []
  const root: CssVariable[] = []

  for (const variable of variables) {
    if (TAILWIND_THEME_NAMESPACES.has(namespaceOf(variable.name))) {
      theme.push(variable)
    } else {
      root.push(variable)
    }
  }

  return [renderBlock('@theme', theme), renderBlock(':root', root)].filter(Boolean).join('\n')
}

/**
 * Renders a flat variable list as a plain CSS override block under an
 * arbitrary selector — the mechanism behind theme and density modes.
 *
 * Overrides are deliberately NOT `@theme` entries: `@theme` exists once and
 * generates utility classes from the light values. Because every generated
 * utility references its token as `var(--...)`, redefining the custom
 * property under a mode selector restyles the whole system without
 * Tailwind's involvement.
 *
 * @param selector - The CSS selector scoping the overrides.
 * @param variables - Flattened custom properties to emit inside the block.
 * @returns The CSS block, or an empty string when there is nothing to emit.
 */
export function renderOverrideBlock(selector: string, variables: readonly CssVariable[]): string {
  if (variables.length === 0) return ''
  const lines = variables.map((variable) => `  ${variable.name}: ${variable.value};`)
  return `${selector} {\n${lines.join('\n')}\n}\n`
}
