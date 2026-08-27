import { flattenTokens, type TokenTree } from './flatten.ts'
import { renderCss, renderOverrideBlock } from './css.ts'

/**
 * The Sentra design token source of truth.
 *
 * Every visual constant in the platform originates here. Components must not
 * hard-code colour, spacing, or timing values — they reference the generated
 * custom properties instead, which is what allows a theme change to propagate
 * without touching component source.
 *
 * Naming follows Tailwind 4 theme namespaces where a namespace exists, so that
 * `--color-brand-500` automatically yields `bg-brand-500` and friends. Tokens
 * outside those namespaces (`duration`, `zIndex`) are emitted to `:root` and
 * consumed via `var()`.
 */
export const tokens: TokenTree = {
  color: {
    brand: {
      50: '#eff6ff',
      100: '#dbeafe',
      300: '#93c5fd',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      900: '#1e3a8a',
    },
    neutral: {
      0: '#ffffff',
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      500: '#6b7280',
      700: '#374151',
      900: '#111827',
    },
    danger: {
      100: '#fee2e2',
      500: '#ef4444',
      700: '#b91c1c',
    },
    success: {
      100: '#dcfce7',
      500: '#22c55e',
      700: '#15803d',
    },
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    full: '9999px',
  },
  spacing: {
    px: '1px',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    6: '1.5rem',
    8: '2rem',
  },
  text: {
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  },
  duration: {
    instant: '0ms',
    fast: '150ms',
    normal: '250ms',
  },
  zIndex: {
    dropdown: 1000,
    overlay: 1200,
    modal: 1300,
    toast: 1400,
  },
}

/**
 * Dark-mode overrides. Only paths that exist in {@link tokens} may appear
 * here — the test suite enforces that invariant — because an override with
 * no light counterpart would be a token that silently vanishes outside dark
 * mode.
 *
 * `color.neutral.600`, `color.neutral.800`, `color.danger.600`, and
 * `color.success.600` were dropped from the plan's original list: none of
 * those paths exist in the M1 base tree (`neutral` has no `600`/`800` step,
 * and `danger`/`success` have no `600` step), so inventing a base token to
 * host them was out of scope for this task.
 */
export const darkTokens: TokenTree = {
  color: {
    brand: {
      50: '#1e2a4a',
      600: '#7d9bf5',
      700: '#93adf7',
    },
    neutral: {
      50: '#18181b',
      100: '#27272a',
      200: '#3f3f46',
      300: '#52525b',
      700: '#e4e4e7',
      900: '#fafafa',
    },
  },
}

/**
 * Density overrides, keyed by mode. Compact tightens the spacing scale for
 * data-heavy screens (the console app in M4 is the intended consumer);
 * component code never branches on density — the variables do the work.
 */
export const densityTokens: { compact: TokenTree } = {
  compact: {
    spacing: {
      2: '0.375rem',
      3: '0.5rem',
      4: '0.75rem',
      6: '1rem',
    },
  },
}

/**
 * Runs the full token pipeline: source tree → flat variables → CSS text.
 *
 * Exposed as a function rather than a constant so the build script and the test
 * suite exercise the identical code path, and so determinism is assertable.
 *
 * Composes the complete stylesheet: the @theme block Tailwind reads, plain
 * :root custom properties Tailwind has no namespace for, the dark custom
 * variant declaration, and the mode override blocks.
 *
 * @returns CSS text containing, in order: `@theme` block, `:root` extras,
 * the `@custom-variant dark` declaration, the dark override block, and the
 * compact density override block.
 */
export function buildTokensCss(): string {
  const light = renderCss(flattenTokens(tokens))
  const darkVariant = '@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));\n'
  const dark = renderOverrideBlock(":root[data-theme='dark']", flattenTokens(darkTokens))
  const compact = renderOverrideBlock(
    "[data-density='compact']",
    flattenTokens(densityTokens.compact),
  )
  return [light, darkVariant, dark, compact].filter(Boolean).join('\n')
}
