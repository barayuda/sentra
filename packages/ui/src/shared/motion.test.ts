import { describe, expect, it } from 'vitest'
import {
  DRAWER_PANEL_MOTION,
  MODAL_PANEL_MOTION,
  OVERLAY_MOTION,
  POPOVER_MOTION,
  TOAST_MOTION,
  type TransitionPreset,
} from './motion.ts'

const PRESETS: Record<string, TransitionPreset> = {
  OVERLAY_MOTION,
  DRAWER_PANEL_MOTION,
  MODAL_PANEL_MOTION,
  POPOVER_MOTION,
  TOAST_MOTION,
}

/**
 * The classes that carry timing. Only the active classes do: `enterFrom` and
 * `leaveTo` describe positions, and a duration on them would do nothing.
 */
function activeClasses(preset: TransitionPreset): string[] {
  return [preset.enterActiveClass, preset.leaveActiveClass]
}

describe('motion presets', () => {
  it.each(Object.entries(PRESETS))('%s times itself from a duration token', (_name, preset) => {
    /*
     * The reduced-motion override in the token stylesheet works by
     * redeclaring `--duration-*` under `prefers-reduced-motion: reduce`. A
     * preset that wrote `duration-200` instead would keep animating under
     * that setting, and nothing else in the suite would notice — the page
     * still looks right to anyone who has not set the preference.
     */
    for (const className of activeClasses(preset)) {
      expect(className, `${_name} is missing a duration`).toMatch(
        /duration-\[var\(--duration-[a-z]+\)\]/,
      )
      expect(className, `${_name} hard-codes a duration`).not.toMatch(/duration-\d/)
    }
  })

  it.each(Object.entries(PRESETS))('%s eases with a Sentra curve', (_name, preset) => {
    /*
     * `ease-in`, `ease-out`, `ease-in-out` and `ease-linear` are Tailwind's
     * own utilities. Using one here would be legal CSS and would look fine,
     * but it would mean this preset is no longer described by the token
     * layer — changing the platform's easing would leave it behind.
     */
    for (const className of activeClasses(preset)) {
      expect(className, `${_name} is missing an easing curve`).toMatch(
        /ease-(standard|enter|exit)\b/,
      )
      expect(className, `${_name} uses a Tailwind built-in curve`).not.toMatch(
        /ease-(linear|in|out|in-out)\b/,
      )
    }
  })

  it('animates the dialog presets on first render and the others on toggle', () => {
    /*
     * `Dialog` defers its `<Teleport>` until after mount, so when a dialog is
     * open on the very first paint its `<Transition>` is created with the
     * child already present — an initial render, which Vue does not animate
     * without `appear`. The popover and toast transitions are mounted well
     * before their children exist, so every appearance is a toggle and
     * `appear` would only cost a wasted animation on page load.
     */
    expect(OVERLAY_MOTION.appear).toBe(true)
    expect(DRAWER_PANEL_MOTION.appear).toBe(true)
    expect(MODAL_PANEL_MOTION.appear).toBe(true)
    expect(POPOVER_MOTION.appear).toBeUndefined()
    expect(TOAST_MOTION.appear).toBeUndefined()
  })

  it('leaves faster than it enters, except where the surface is transient', () => {
    /*
     * Departure is acknowledgement, not information: a dismissal that takes
     * as long as an arrival reads as lag. Asserted on the token names rather
     * than on milliseconds, because the milliseconds live in @sentra/tokens
     * and this package should not restate them.
     *
     * The exception is named explicitly rather than skipped by inspecting
     * the preset. A test that skipped any preset whose enter was already
     * fast would go quiet the moment someone made the drawer enter fast —
     * which is precisely the regression it exists to catch.
     */
    const SYMMETRIC = new Set(['POPOVER_MOTION'])
    for (const [name, preset] of Object.entries(PRESETS)) {
      const enter = SYMMETRIC.has(name) ? '--duration-fast' : '--duration-normal'
      expect(preset.enterActiveClass, `${name} enter`).toContain(enter)
      expect(preset.leaveActiveClass, `${name} leave`).toContain('--duration-fast')
    }
  })

  it('mirrors the drawer slide for right-to-left locales', () => {
    /*
     * The drawer is anchored with the logical `justify-end`, so in an RTL
     * locale it sits on the left — but `translate-x-full` is physical and
     * would still start it off the right edge, sliding it across the whole
     * viewport from the wrong side.
     */
    expect(DRAWER_PANEL_MOTION.enterFromClass).toContain('rtl:-translate-x-full')
    expect(DRAWER_PANEL_MOTION.leaveToClass).toContain('rtl:-translate-x-full')
  })

  it('gives the toast group a tokenised move transition', () => {
    /* Without `moveClass` the toasts below a dismissed one jump to their new
       positions instantly — the one moment the stack is under the user's eye. */
    expect(TOAST_MOTION.moveClass).toMatch(/duration-\[var\(--duration-[a-z]+\)\]/)
    expect(TOAST_MOTION.moveClass).toMatch(/ease-(standard|enter|exit)\b/)
  })
})
