import { FOCUS_CLASSES, SIZE_CLASSES, type Size } from '../../shared/controls.ts'

/**
 * Visual emphasis levels for `Button`.
 *
 * Deliberately small: four levels express an unambiguous emphasis hierarchy.
 * Further variants belong in application code as composition, not here.
 */
export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

/**
 * Utilities applied to every button regardless of variant or size.
 */
const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

/**
 * Background, text, and hover utilities per {@link Variant}.
 */
const VARIANT_CLASSES: Readonly<Record<Variant, string>> = {
  primary: 'bg-brand-600 text-neutral-0 hover:bg-brand-700',
  secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
  ghost: 'bg-transparent text-brand-600 hover:bg-brand-50',
  /**
   * `danger-500` against white text measures 3.76:1 — below the 4.5:1 WCAG AA
   * threshold for normal text (confirmed by the interaction/a11y CI gate).
   * `danger-700` is the only shade in the three-step danger scale
   * (100/500/700) that clears it, at ~6.47:1, so it is the resting
   * background; hover reuses it at 90% opacity for a visible-but-compliant
   * state change rather than inventing an unreviewed darker token.
   */
  danger: 'bg-danger-700 text-neutral-0 hover:bg-danger-700/90',
}

/**
 * Composes the full class string for a `Button`.
 *
 * Extracted from the component so the logic is unit-testable without mounting
 * Vue, and so every class name appears as a literal in source — Tailwind scans
 * source text, and a name assembled by string concatenation at runtime would
 * never be generated.
 *
 * @param variant - Visual emphasis level.
 * @param size - Control height.
 * @returns A space-separated class string.
 *
 * @example
 * ```ts
 * buttonClasses('danger', 'sm')
 * ```
 */
export function buttonClasses(variant: Variant, size: Size): string {
  return [BASE_CLASSES, FOCUS_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size]].join(' ')
}
