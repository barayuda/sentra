/**
 * Transition presets shared by the components that appear and disappear.
 *
 * Every preset is a plain object of Vue `<Transition>` props, so a component
 * applies one with `v-bind` and adds no motion logic of its own. Keeping them
 * here rather than inline serves the same purpose as `controls.ts`: three
 * components need the same timings, and a drawer that eased differently from
 * a toast would read as two design systems in one product.
 *
 * Timing and easing come from `@sentra/tokens` — `duration-[var(--duration-*)]`
 * and the `ease-*` utilities Tailwind generates from the `--ease-*` theme
 * variables. No preset hard-codes a millisecond value, which is what lets the
 * reduced-motion override in the token stylesheet collapse all of this to zero
 * without a single component knowing it happened.
 */

/**
 * The Vue `<Transition>` props a preset supplies.
 *
 * Modelled as an explicit interface rather than inferred so that a typo in a
 * preset key is a type error instead of a prop Vue silently ignores — a
 * misspelled `leaveToClass` would leave the element mid-transition with no
 * error anywhere.
 */
export interface TransitionPreset {
  /** Whether to animate the initial render, not just later toggles. */
  readonly appear?: boolean
  readonly enterActiveClass: string
  readonly enterFromClass: string
  readonly enterToClass: string
  readonly leaveActiveClass: string
  readonly leaveFromClass: string
  readonly leaveToClass: string
}

/**
 * Enter is slower than leave throughout these presets, and the curves differ.
 *
 * Arrival is information — the user needs to see where the thing came from,
 * so it decelerates into place over the longer duration. Departure is
 * acknowledgement — the decision is already made, so it accelerates away over
 * the shorter one. Symmetric timing feels sluggish on dismissal for exactly
 * this reason: waiting on an animation for something you have finished with.
 */
const ENTER = `duration-[var(--duration-normal)] ease-enter`
const LEAVE = `duration-[var(--duration-fast)] ease-exit`

/**
 * Backdrop and modal-root fade.
 *
 * Applied to the element that holds both the scrim and the panel, so the pair
 * fades as a unit while the panel additionally moves. Two transitions on one
 * subtree rather than one is deliberate: fading a sliding panel separately
 * from its backdrop is what stops the panel appearing to drag the scrim with
 * it.
 */
export const OVERLAY_MOTION: TransitionPreset = {
  appear: true,
  enterActiveClass: `transition-opacity ${ENTER}`,
  enterFromClass: 'opacity-0',
  enterToClass: 'opacity-100',
  leaveActiveClass: `transition-opacity ${LEAVE}`,
  leaveFromClass: 'opacity-100',
  leaveToClass: 'opacity-0',
}

/**
 * Edge-anchored drawer panel: slides in from the inline end.
 *
 * The `rtl:` variants mirror the direction. `translate-x-full` is a physical
 * direction while the drawer is anchored with the logical `justify-end`, so
 * without the mirror an Arabic or Hebrew locale would open the panel on the
 * start edge and slide it in from the opposite side of the screen.
 */
export const DRAWER_PANEL_MOTION: TransitionPreset = {
  appear: true,
  enterActiveClass: `transition-transform ${ENTER}`,
  enterFromClass: 'translate-x-full rtl:-translate-x-full',
  enterToClass: 'translate-x-0',
  leaveActiveClass: `transition-transform ${LEAVE}`,
  leaveFromClass: 'translate-x-0',
  leaveToClass: 'translate-x-full rtl:-translate-x-full',
}

/**
 * Centred modal panel: scales up slightly as it fades in with its backdrop.
 *
 * A centred dialog has no edge to travel from, so it grows into place instead.
 * The scale stays near unity — a modal that zooms from nothing reads as a
 * notification rather than a decision point, and the larger the movement the
 * more it costs a user who is sensitive to motion.
 */
export const MODAL_PANEL_MOTION: TransitionPreset = {
  appear: true,
  enterActiveClass: `transition-transform ${ENTER}`,
  enterFromClass: 'scale-95',
  enterToClass: 'scale-100',
  leaveActiveClass: `transition-transform ${LEAVE}`,
  leaveFromClass: 'scale-100',
  leaveToClass: 'scale-95',
}

/**
 * Popover surfaces that open from the control they are anchored to — the
 * `Combobox` listbox. (`Select` wraps a native `<select>`; its dropdown is
 * drawn by the browser and is not ours to animate.)
 *
 * Shorter than the overlay presets in both directions, and the same duration
 * each way. A popover is attached to something the user just clicked and is
 * opened and closed repeatedly while scanning options; drawer timing here
 * would make the control feel unresponsive rather than considered.
 *
 * `origin-top` rides along in the active classes rather than sitting on the
 * element permanently. The scale should grow downward out of the input the
 * listbox belongs to — a popover scaling from its own centre appears to drift
 * upward as it opens — but `transform-origin` matters only while a transform
 * is applied, so scoping it to the transition keeps it out of the element's
 * resting style.
 */
export const POPOVER_MOTION: TransitionPreset = {
  enterActiveClass: 'origin-top transition duration-[var(--duration-fast)] ease-enter',
  enterFromClass: 'opacity-0 scale-95',
  enterToClass: 'opacity-100 scale-100',
  leaveActiveClass: 'origin-top transition duration-[var(--duration-fast)] ease-exit',
  leaveFromClass: 'opacity-100 scale-100',
  leaveToClass: 'opacity-0 scale-95',
}

/**
 * Toast entry and exit, plus the `moveClass` a `<TransitionGroup>` applies to
 * the toasts that shift when a sibling leaves.
 *
 * `moveClass` is the part that distinguishes a group transition from a list of
 * individually-animated items: without it, dismissing the top toast makes
 * every toast below it jump upward the instant it unmounts. It is typed
 * separately because it is not a `<Transition>` prop.
 */
export const TOAST_MOTION: TransitionPreset & { readonly moveClass: string } = {
  enterActiveClass: `transition ${ENTER}`,
  enterFromClass: 'translate-y-2 opacity-0',
  enterToClass: 'translate-y-0 opacity-100',
  leaveActiveClass: `transition ${LEAVE}`,
  leaveFromClass: 'translate-x-0 opacity-100',
  leaveToClass: 'translate-x-4 opacity-0',
  moveClass: 'transition-transform duration-[var(--duration-normal)] ease-standard',
}
