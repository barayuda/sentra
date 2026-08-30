# ADR 0010 — Motion as a token, and reduced motion as a mode

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decides:** where transition timing and easing live, why `prefers-reduced-motion` is
  implemented as a token override rather than as component logic or a global CSS reset,
  how the easing tokens are named, and what this mechanism does **not** cover.

## Context

`@sentra/tokens` shipped `--duration-instant`, `--duration-fast`, and `--duration-normal`
from M1, and `packages/tokens/src/css.ts` already whitelisted `ease` and `animate` as
Tailwind theme namespaces. Neither was used: no component in `@sentra/ui` referenced a
duration token, and no easing token existed. Overlays appeared and disappeared between
frames — a `Dialog` opened by replacing empty space with a full-screen scrim in a single
paint, and a dismissed toast vanished while the toasts below it jumped upward into the
gap.

That is not only a polish problem. An element that appears instantly gives the user no
information about where it came from or what it is attached to, which is the specific
job motion does in a component library: a drawer that slides from the inline end is
legible as an edge-anchored surface, and a listbox that grows out of its input is legible
as belonging to that input.

The reverse obligation is just as real. Vestibular disorders make large or repeated
motion genuinely unpleasant, and every major operating system already collects the user's
answer and exposes it as `prefers-reduced-motion`. A design system that animates without
consulting it is overriding an accessibility preference the user set deliberately.

## Decision

**Timing and easing are tokens. Components never write a millisecond value.**

`packages/tokens/src/tokens.ts` gains an `ease` branch alongside the existing `duration`
branch:

```ts
ease: {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
},
```

**Reduced motion is a mode override, in exactly the sense dark and compact are.** A new
`reducedMotionTokens` export redeclares the two non-zero durations as `0ms`, and
`buildTokensCss` emits it inside a media query:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
  }
}
```

**Components consume presets, not classes.** `packages/ui/src/shared/motion.ts` holds
five `<Transition>` prop objects — `OVERLAY_MOTION`, `DRAWER_PANEL_MOTION`,
`MODAL_PANEL_MOTION`, `POPOVER_MOTION`, `TOAST_MOTION` — each spelling its timing as
`duration-[var(--duration-normal)]` and its curve as `ease-enter`/`ease-exit`/
`ease-standard`. A component applies one with `v-bind` and contains no motion logic:

| Component | Preset | What it does |
| --- | --- | --- |
| `Dialog` (root) | `OVERLAY_MOTION` | Fades the scrim and panel as one layer |
| `Dialog` (`placement="end"`) | `DRAWER_PANEL_MOTION` | Slides the panel in from the inline end |
| `Dialog` (`placement="center"`) | `MODAL_PANEL_MOTION` | Scales the panel into place |
| `Combobox` | `POPOVER_MOTION` | Grows the listbox out of its input |
| `ToastHost` | `TOAST_MOTION` | Enter, exit, **and** the group's move transition |

## Why a token override rather than the alternatives

**Not a branch in component code.** A `usePrefersReducedMotion()` composable would work,
but every component would then have to remember to call it, a component that forgot would
be indistinguishable from one that did not animate at all, and consumer code outside this
workspace would get nothing. The override reaches every rule that references a duration
token, including code we never wrote.

**Not a global `* { animation: none !important }` reset.** `packages/ui/src/styles.css`
forbids unlayered CSS in this package on purpose: Tailwind emits into cascade layers, and
CSS gives unlayered styles precedence over any layered style, so an unlayered rule here
would let this package outrank a consumer's own overrides — the opposite of the guarantee
the package makes. An `!important` reset would also flatten motion the consumer
deliberately kept.

**Source order is the mechanism, and it is load-bearing.** All four override blocks —
dark, compact, reduced-motion, and the base `:root` — target custom properties at equal
specificity. Emitting reduced motion last is the only reason it outranks the others. This
is asserted directly in `packages/tokens/src/tokens.test.ts` rather than left to
convention.

## Why the easing tokens are not named `in`, `out`, and `in-out`

`ease` is a Tailwind theme namespace, so `--ease-standard` generates an `ease-standard`
utility. Tailwind also ships `ease-linear`, `ease-in`, `ease-out`, and `ease-in-out` of
its own. A token on any of those keys would **silently redefine a built-in utility** for
every consumer of the stylesheet, changing what those classes mean in code that never
asked for a Sentra curve and never mentioned Sentra at all.

Role-based names avoid the collision by construction, and a test in
`packages/tokens/src/tokens.test.ts` fails if any of the four reserved keys is
reintroduced. The names also carry more information than the shapes do: `enter`
decelerates because an arriving element should settle where it belongs, `exit`
accelerates because a departing element should not be watched, and `standard` eases both
ends for an element that moves while staying on screen.

## What the `duration` token does not reach

**Keyframe animations.** The reduced-motion override redeclares duration *variables*, so
it reaches every rule that reads one. Tailwind's `animate-*` utilities do not: they set
`animation` with their own hard-coded duration. `ProductCard`'s loading skeleton uses
`animate-pulse`, and it therefore **keeps pulsing under `prefers-reduced-motion: reduce`**.

This is a real, known gap, recorded rather than hidden. Closing it needs a rule that
outranks `.animate-pulse` (specificity 0,1,0, inside Tailwind's utilities layer) without
writing unlayered or `!important` CSS in this package — a cascade-layer interaction we
could not verify with confidence in the time available, and one where an unverified fix
is worse than a documented limitation. `animate-pulse` is a low-amplitude opacity fade
rather than positional movement, which is the mildest category of motion for the users
this setting protects; that makes it an acceptable thing to carry, not an acceptable
thing to leave undocumented.

**Anything a component animates without the token.** Nothing does today. The preset
contract is enforced by `packages/ui/src/shared/motion.test.ts`, which fails any preset
carrying a literal duration (`duration-200`) or a Tailwind built-in curve — the two ways
a future change would quietly opt out of the override.

## What is deliberately not animated

`Select` wraps a native `<select>`. Its dropdown is drawn by the browser, is not in the
document, and is not ours to animate. The approved scope named "Select/Combobox
popovers"; only `Combobox` has a popover to move. This is recorded in `POPOVER_MOTION`'s
docblock so the next reader does not go looking for the missing half.

Route transitions, list stagger on the product grid, and the View Transitions API were
considered and dropped. Each of them animates content the user asked to see, which is
where motion most often turns into latency.

## Consequences

- One edit to `tokens.ts` retimes or recurves every overlay in the platform, including
  consumer code that follows the `var(--duration-*)` convention.
- A user with reduced motion enabled gets the same components with no transitions — not a
  degraded variant, and not a separate code path anyone has to maintain.
- Tests had to stop stubbing `<Transition>`. Vue Test Utils replaces it with a real
  `<transition-stub>` **element**, which becomes a node in the tree and silently changes
  what `parentElement` means for every transitioned child — several existing assertions
  were describing Vue Test Utils' shape rather than ours. `packages/ui/vitest.setup.ts`
  now disables both stubs and clears `document.body` after `cleanup()`, because a leave
  transition defers removal past the point teleported content would otherwise be cleaned
  up.
- Storybook play functions that assert an overlay is gone must wait for the leave. A bare
  `queryByRole('dialog')` check immediately after Escape passes in happy-dom (where
  nothing has a duration) and fails in a real browser. Both Dialog play functions now use
  `waitForElementToBeRemoved`.
