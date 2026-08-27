import { flattenTokens, type TokenTree } from './flatten.ts'
import { renderCss } from './css.ts'

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
 * Runs the full token pipeline: source tree → flat variables → CSS text.
 *
 * Exposed as a function rather than a constant so the build script and the test
 * suite exercise the identical code path, and so determinism is assertable.
 *
 * @returns CSS text containing an `@theme` block followed by a `:root` block.
 */
export function buildTokensCss(): string {
  return renderCss(flattenTokens(tokens))
}
