/**
 * Control heights shared across every Sentra form control.
 *
 * One scale for all controls is what lets a `Button` and an `Input` sit on the
 * same row and align without per-call-site adjustment.
 */
export type Size = 'sm' | 'md' | 'lg'

/**
 * Padding and text-size utilities per {@link Size}.
 *
 * Lives in `shared/` rather than in any one component's directory because three
 * components consume it; placing it under `Button/` would make `Input` import
 * from a sibling component, coupling them for no reason.
 */
export const SIZE_CLASSES: Readonly<Record<Size, string>> = {
  sm: 'text-sm px-3 py-1',
  md: 'text-base px-4 py-2',
  lg: 'text-lg px-6 py-3',
}

/**
 * Focus-ring utilities applied to every interactive control.
 *
 * Uses `focus-visible` rather than `focus`, so keyboard users get a visible ring
 * while pointer users do not. Removing the ring outright would be an
 * accessibility regression, which is why this is a shared constant rather than a
 * per-component decision.
 */
export const FOCUS_CLASSES =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

/**
 * Utilities shared by bordered text-entry fields (`Input`, `Select`).
 *
 * Excludes size utilities so callers compose with {@link SIZE_CLASSES}.
 */
export const FIELD_CLASSES =
  'w-full rounded-md border border-neutral-300 bg-neutral-0 text-neutral-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed aria-[invalid=true]:border-danger-500'
